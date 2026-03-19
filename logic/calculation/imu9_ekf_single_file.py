#!/usr/bin/env python3
"""
Single-file 9-axis IMU EKF post-processing script.

This script ports the MATLAB project logic into one Python file:
- LSB -> SI conversion
- Gyroscope bias compensation
- Magnetometer hard-iron compensation
- Quaternion EKF (predict + correct)
- Euler angle extraction
- Timeline plots and optional 3D animation

Input text format per row:
AccX AccY AccZ GyroX GyroY GyroZ MagX MagY MagZ Time(ms)
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from mpl_toolkits.mplot3d.art3d import Poly3DCollection


@dataclass
class EKFConfig:
    # Unit conversion constants (aligned to mpu9250.ino settings: 16G / 2000dps)
    g: float = 9.8
    unit_transform_acc: float = 2048.0
    unit_transform_gyro: float = np.pi / (180.0 * 16.4)
    unit_transform_mag: float = 0.6

    # Calibration windows
    gyro_compen_k: int = 30
    mag_compen_k: int = 1000
    ref_mag: int = 30

    # EKF covariance scales
    n_q: float = 1.0
    n_r: float = 100.0
    n_p: float = 1.0


class QuaternionEKF:
    def __init__(self, n_q: float, n_r: float, n_p: float) -> None:
        self.Q = n_q * np.eye(4)
        self.R = n_r * np.eye(6)
        self.x = np.array([[1.0], [0.0], [0.0], [0.0]], dtype=float)
        self.P = n_p * np.eye(4)

    @staticmethod
    def _fjacob(p: float, q: float, r: float, dt: float) -> np.ndarray:
        F = np.zeros((4, 4), dtype=float)
        F[0, 0] = 1.0
        F[0, 1] = -p * dt / 2.0
        F[0, 2] = -q * dt / 2.0
        F[0, 3] = -r * dt / 2.0

        F[1, 0] = p * dt / 2.0
        F[1, 1] = 1.0
        F[1, 2] = r * dt / 2.0
        F[1, 3] = -q * dt / 2.0

        F[2, 0] = q * dt / 2.0
        F[2, 1] = -r * dt / 2.0
        F[2, 2] = 1.0
        F[2, 3] = p * dt / 2.0

        F[3, 0] = r * dt / 2.0
        F[3, 1] = p * dt / 2.0
        F[3, 2] = -q * dt / 2.0
        F[3, 3] = 1.0
        return F

    @staticmethod
    def _hjacob(q0: float, q1: float, q2: float, q3: float, B: np.ndarray) -> np.ndarray:
        H = np.zeros((6, 4), dtype=float)

        # Accelerometer model jacobian
        H[0, 0] = -q2
        H[0, 1] = q3
        H[0, 2] = -q0
        H[0, 3] = q1

        H[1, 0] = q1
        H[1, 1] = q0
        H[1, 2] = q3
        H[1, 3] = q2

        H[2, 0] = q0
        H[2, 1] = -q1
        H[2, 2] = -q2
        H[2, 3] = q3

        # Magnetometer model jacobian
        b1, b2, b3 = B

        H[3, 0] = q0 * b1 + q3 * b2 - q2 * b3
        H[3, 1] = q1 * b1 + q2 * b2 + q3 * b3
        H[3, 2] = -q2 * b1 + q1 * b2 - q0 * b3
        H[3, 3] = -q3 * b1 + q0 * b2 + q1 * b3

        H[4, 0] = -q3 * b1 + q0 * b2 + q1 * b3
        H[4, 1] = q2 * b1 - q1 * b2 + q0 * b3
        H[4, 2] = q1 * b1 + q2 * b2 + q3 * b3
        H[4, 3] = -q0 * b1 - q3 * b2 + q2 * b3

        H[5, 0] = q2 * b1 - q1 * b2 + q0 * b3
        H[5, 1] = q3 * b1 - q0 * b2 - q1 * b3
        H[5, 2] = q0 * b1 + q3 * b2 - q2 * b3
        H[5, 3] = q1 * b1 + q2 * b2 + q3 * b3

        return H

    def step(
        self,
        p: float,
        q: float,
        r: float,
        B: np.ndarray,
        mx: float,
        my: float,
        mz: float,
        ax: float,
        ay: float,
        az: float,
        dt: float,
    ) -> np.ndarray:
        # Predict
        F = self._fjacob(p, q, r, dt)
        xp = F @ self.x
        Pp = F @ self.P @ F.T + self.Q

        # Correct (linearize at predicted state)
        H = self._hjacob(float(xp[0, 0]), float(xp[1, 0]), float(xp[2, 0]), float(xp[3, 0]), B)
        S = H @ Pp @ H.T + self.R
        K = Pp @ H.T @ np.linalg.inv(S)

        z = np.array([[ax], [ay], [az], [mx], [my], [mz]], dtype=float)
        self.x = xp + K @ (z - H @ xp)
        self.P = Pp - K @ H @ Pp

        # Keep quaternion on unit sphere
        norm_x = np.linalg.norm(self.x)
        if norm_x > 0.0:
            self.x = self.x / norm_x

        return self.x.copy()


class IMU9AxisEKFAPI:
    """Streaming-style API for external callers.

    Usage from another file:
        from imu9_ekf_single_file import IMU9AxisEKFAPI
        api = IMU9AxisEKFAPI()
        out = api.process_sample([ax, ay, az, gx, gy, gz, mx, my, mz], time_ms)
        corrected9 = out["corrected_9"]
    """

    def __init__(self, cfg: EKFConfig | None = None) -> None:
        self.cfg = cfg or EKFConfig()
        self.ekf = QuaternionEKF(self.cfg.n_q, self.cfg.n_r, self.cfg.n_p)

        self._last_time_s: float | None = None
        self._gyro_boot: list[np.ndarray] = []
        self._mag_boot: list[np.ndarray] = []

        self._gyro_bias = np.zeros(3, dtype=float)
        self._mag_bias = np.zeros(3, dtype=float)
        self._B = np.array([1.0, 0.0, 0.0], dtype=float)

        self._gyro_ready = False
        self._mag_ready = False

    def _lsb_to_si_9(self, raw_9: np.ndarray) -> np.ndarray:
        x = np.asarray(raw_9, dtype=float)
        if x.shape != (9,):
            raise ValueError("raw_9 must be length-9: [ax ay az gx gy gz mx my mz].")

        out = np.zeros(9, dtype=float)
        out[0:3] = (self.cfg.g / self.cfg.unit_transform_acc) * x[0:3]
        out[3:6] = self.cfg.unit_transform_gyro * x[3:6]
        out[6:9] = self.cfg.unit_transform_mag * x[6:9]
        return out

    def _update_bootstrap(self, si_9: np.ndarray) -> None:
        if not self._gyro_ready:
            self._gyro_boot.append(si_9[3:6].copy())
            if len(self._gyro_boot) >= self.cfg.gyro_compen_k:
                self._gyro_bias = np.mean(np.vstack(self._gyro_boot), axis=0)
                self._gyro_ready = True

        if not self._mag_ready:
            self._mag_boot.append(si_9[6:9].copy())
            if len(self._mag_boot) >= self.cfg.mag_compen_k:
                mag_arr = np.vstack(self._mag_boot)
                mx = mag_arr[:, 0]
                my = mag_arr[:, 1]
                mz = mag_arr[:, 2]
                Y = (mx * mx + my * my + mz * mz).reshape(-1, 1)
                X = np.column_stack([mx, my, mz, np.ones(len(mag_arr))])
                beta = 0.5 * np.linalg.inv(X.T @ X) @ X.T @ Y
                self._mag_bias = beta[:3, 0]

                # Reference magnetic vector from latest corrected sample
                b = mag_arr[-1, :] - self._mag_bias
                b_norm = np.linalg.norm(b)
                if b_norm > 0.0:
                    self._B = b / b_norm
                self._mag_ready = True

    def process_sample(self, raw_9: np.ndarray, time_ms: float) -> Dict[str, np.ndarray | float | bool]:
        """Process one IMU sample and return corrected 9-axis data.

        Returns keys:
        - corrected_9: np.ndarray shape (9,) [acc, gyro, mag] in SI and bias-compensated
        - euler_rad: np.ndarray shape (3,)
        - euler_deg: np.ndarray shape (3,)
        - quaternion: np.ndarray shape (4,)
        - ready: bool (True when gyro/mag bootstrapping completed)
        """
        si_9 = self._lsb_to_si_9(np.asarray(raw_9, dtype=float))
        self._update_bootstrap(si_9)

        corrected = si_9.copy()
        corrected[3:6] = corrected[3:6] - self._gyro_bias
        corrected[6:9] = corrected[6:9] - self._mag_bias

        time_s = float(time_ms) / 1000.0
        if self._last_time_s is None:
            dt = 0.0
        else:
            dt = max(0.0, time_s - self._last_time_s)
        self._last_time_s = time_s

        euler_rad = np.zeros(3, dtype=float)
        q = self.ekf.x[:, 0].copy()

        g_norm = np.linalg.norm(corrected[0:3])
        m_norm = np.linalg.norm(corrected[6:9])
        if dt > 0.0 and g_norm > 0.0 and m_norm > 0.0:
            ax, ay, az = corrected[0:3] / g_norm
            mx, my, mz = corrected[6:9] / m_norm
            p, qg, r = corrected[3:6]

            qv = self.ekf.step(p, qg, r, self._B, mx, my, mz, ax, ay, az, dt)
            q = qv[:, 0]

            q0, q1, q2, q3 = q
            phi = np.arctan2(2 * (q2 * q3 + q0 * q1), 1 - 2 * (q1 * q1 + q2 * q2))
            theta = -np.arcsin(np.clip(2 * (q1 * q3 - q0 * q2), -1.0, 1.0))
            psi = np.arctan2(2 * (q1 * q2 + q0 * q3), 1 - 2 * (q2 * q2 + q3 * q3))
            euler_rad = np.array([phi, theta, psi], dtype=float)

        return {
            "corrected_9": corrected,
            "euler_rad": euler_rad,
            "euler_deg": np.rad2deg(euler_rad),
            "quaternion": q,
            "ready": bool(self._gyro_ready and self._mag_ready),
        }


def load_data(file_path: Path) -> np.ndarray:
    data = np.loadtxt(file_path, dtype=float)
    if data.ndim == 1:
        data = data.reshape(1, -1)
    if data.shape[1] != 10:
        raise ValueError(f"Expected 10 columns, got {data.shape[1]}.")
    return data


def convert_to_si(data_raw: np.ndarray, cfg: EKFConfig) -> np.ndarray:
    data_si = np.zeros_like(data_raw, dtype=float)

    # Acc: LSB -> m/s^2
    data_si[:, 0] = (cfg.g / cfg.unit_transform_acc) * data_raw[:, 0]
    data_si[:, 1] = (cfg.g / cfg.unit_transform_acc) * data_raw[:, 1]
    data_si[:, 2] = (cfg.g / cfg.unit_transform_acc) * data_raw[:, 2]

    # Gyro: LSB -> rad/s
    data_si[:, 3] = cfg.unit_transform_gyro * data_raw[:, 3]
    data_si[:, 4] = cfg.unit_transform_gyro * data_raw[:, 4]
    data_si[:, 5] = cfg.unit_transform_gyro * data_raw[:, 5]

    # Mag: LSB -> uT
    data_si[:, 6] = cfg.unit_transform_mag * data_raw[:, 6]
    data_si[:, 7] = cfg.unit_transform_mag * data_raw[:, 7]
    data_si[:, 8] = cfg.unit_transform_mag * data_raw[:, 8]

    # Time: ms -> s
    data_si[:, 9] = data_raw[:, 9] / 1000.0

    return data_si


def compensate_gyro_bias(data_si: np.ndarray, cfg: EKFConfig) -> Tuple[np.ndarray, np.ndarray]:
    n_samples = data_si.shape[0]
    k = min(cfg.gyro_compen_k, n_samples)
    bias = np.array([
        np.mean(data_si[:k, 3]),
        np.mean(data_si[:k, 4]),
        np.mean(data_si[:k, 5]),
    ])
    data_si[:, 3:6] = data_si[:, 3:6] - bias
    return data_si, bias


def compensate_mag_hardiron(data_si: np.ndarray, cfg: EKFConfig) -> Tuple[np.ndarray, np.ndarray]:
    n_samples = data_si.shape[0]
    k = min(cfg.mag_compen_k, n_samples)

    mx = data_si[:k, 6]
    my = data_si[:k, 7]
    mz = data_si[:k, 8]

    Y = (mx * mx + my * my + mz * mz).reshape(-1, 1)
    X = np.column_stack([mx, my, mz, np.ones(k)])

    # Same least-squares form used by the MATLAB script
    beta = 0.5 * np.linalg.inv(X.T @ X) @ X.T @ Y
    bias = beta[:3, 0]

    data_si[:, 6] = data_si[:, 6] - bias[0]
    data_si[:, 7] = data_si[:, 7] - bias[1]
    data_si[:, 8] = data_si[:, 8] - bias[2]

    return data_si, bias


def reference_magnetic_vector(data_si: np.ndarray, cfg: EKFConfig) -> np.ndarray:
    n_samples = data_si.shape[0]
    idx = min(cfg.ref_mag, n_samples) - 1
    b = data_si[idx, 6:9]
    mag = np.linalg.norm(b)
    if mag == 0:
        return np.array([1.0, 0.0, 0.0])
    return b / mag


def run_ekf(data_si: np.ndarray, B: np.ndarray, cfg: EKFConfig) -> np.ndarray:
    n_samples = data_si.shape[0]
    euler = np.zeros((n_samples - 1, 3), dtype=float)

    ekf = QuaternionEKF(cfg.n_q, cfg.n_r, cfg.n_p)

    for k in range(n_samples - 1):
        ax, ay, az = data_si[k, 0], data_si[k, 1], data_si[k, 2]
        p, q, r = data_si[k, 3], data_si[k, 4], data_si[k, 5]
        mx, my, mz = data_si[k, 6], data_si[k, 7], data_si[k, 8]
        dt = data_si[k + 1, 9] - data_si[k, 9]

        # Normalize accel / mag measurements
        g_norm = np.linalg.norm([ax, ay, az])
        m_norm = np.linalg.norm([mx, my, mz])
        if g_norm == 0 or m_norm == 0:
            continue

        ax, ay, az = ax / g_norm, ay / g_norm, az / g_norm
        mx, my, mz = mx / m_norm, my / m_norm, mz / m_norm

        qv = ekf.step(p, q, r, B, mx, my, mz, ax, ay, az, dt)
        q0, q1, q2, q3 = qv[:, 0]

        # Quaternion -> Euler (same formula as MATLAB script)
        phi = np.arctan2(2 * (q2 * q3 + q0 * q1), 1 - 2 * (q1 * q1 + q2 * q2))
        theta = -np.arcsin(np.clip(2 * (q1 * q3 - q0 * q2), -1.0, 1.0))
        psi = np.arctan2(2 * (q1 * q2 + q0 * q3), 1 - 2 * (q2 * q2 + q3 * q3))
        euler[k, :] = [phi, theta, psi]

    return euler


def plot_timeseries(data_si: np.ndarray, euler_deg: np.ndarray) -> None:
    t = data_si[:, 9]

    # Euler
    fig1, ax1 = plt.subplots(figsize=(10, 4))
    ax1.plot(t[:-1], euler_deg[:, 0], "r", label="Phi")
    ax1.plot(t[:-1], euler_deg[:, 1], "b", label="Theta")
    ax1.plot(t[:-1], euler_deg[:, 2], "g", label="Psi")
    ax1.axhline(0, color="k", linewidth=0.7)
    ax1.set_title("Euler Angle (degree)")
    ax1.set_xlabel("Time (s)")
    ax1.set_ylabel("deg")
    ax1.set_xlim([0, t[-1]])
    ax1.set_ylim([-300, 300])
    ax1.legend(loc="upper left")
    ax1.grid(True, alpha=0.25)

    # Sensor channels
    fig2, axs = plt.subplots(1, 3, figsize=(15, 4))

    axs[0].plot(t, data_si[:, 0], "r", label="AccX")
    axs[0].plot(t, data_si[:, 1], "g", label="AccY")
    axs[0].plot(t, data_si[:, 2], "b", label="AccZ")
    axs[0].axhline(0, color="k", linewidth=0.7)
    axs[0].set_title("Acceleration (m/s^2)")
    axs[0].set_xlim([0, t[-1]])
    axs[0].set_ylim([-20, 20])
    axs[0].legend(loc="upper left")
    axs[0].grid(True, alpha=0.25)

    axs[1].plot(t, data_si[:, 3], "r", label="GyroX")
    axs[1].plot(t, data_si[:, 4], "g", label="GyroY")
    axs[1].plot(t, data_si[:, 5], "b", label="GyroZ")
    axs[1].axhline(0, color="k", linewidth=0.7)
    axs[1].set_title("Angular velocity (rad/s)")
    axs[1].set_xlim([0, t[-1]])
    axs[1].set_ylim([-3, 3])
    axs[1].legend(loc="upper left")
    axs[1].grid(True, alpha=0.25)

    axs[2].plot(t, data_si[:, 6], "r", label="MagX")
    axs[2].plot(t, data_si[:, 7], "g", label="MagY")
    axs[2].plot(t, data_si[:, 8], "b", label="MagZ")
    axs[2].axhline(0, color="k", linewidth=0.7)
    axs[2].set_title("Magnetic flux density (uT)")
    axs[2].set_xlim([0, t[-1]])
    axs[2].set_ylim([-40, 40])
    axs[2].legend(loc="upper left")
    axs[2].grid(True, alpha=0.25)

    plt.tight_layout()


def animate_imu(euler_deg: np.ndarray, t: np.ndarray) -> None:
    # Cuboid vertices (same shape intent as MATLAB)
    cuboid = np.array(
        [
            [-2.0, -3.0, -0.5],
            [2.0, -3.0, -0.5],
            [2.0, 3.0, -0.5],
            [-2.0, 3.0, -0.5],
            [-2.0, -3.0, 0.5],
            [2.0, -3.0, 0.5],
            [2.0, 3.0, 0.5],
            [-2.0, 3.0, 0.5],
        ]
    )

    faces_idx = np.array(
        [
            [0, 1, 5, 4],
            [1, 2, 6, 5],
            [2, 3, 7, 6],
            [3, 0, 4, 7],
            [0, 1, 2, 3],
            [4, 5, 6, 7],
        ]
    )

    fig = plt.figure(figsize=(6, 6))
    ax = fig.add_subplot(111, projection="3d")
    ax.set_title("IMU state")
    ax.set_xlim(-5, 5)
    ax.set_ylim(-5, 5)
    ax.set_zlim(-5, 5)
    ax.set_box_aspect((1, 1, 1))

    poly = Poly3DCollection([], facecolor="g", edgecolor="k", alpha=0.8)
    ax.add_collection3d(poly)
    time_text = ax.text2D(0.05, 0.95, "", transform=ax.transAxes)

    def rot_mats(phi: float, theta: float, psi: float) -> np.ndarray:
        cp, sp = np.cos(np.deg2rad(phi)), np.sin(np.deg2rad(phi))
        ct, st = np.cos(np.deg2rad(theta)), np.sin(np.deg2rad(theta))
        cy, sy = np.cos(np.deg2rad(psi)), np.sin(np.deg2rad(psi))

        rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
        ry = np.array([[ct, 0, st], [0, 1, 0], [-st, 0, ct]])
        rz = np.array([[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]])
        return rx @ ry @ rz

    def update(frame: int):
        phi, theta, psi = euler_deg[frame]
        R = rot_mats(phi, theta, psi)
        rotated = (R @ cuboid.T).T
        faces = [rotated[idx] for idx in faces_idx]
        poly.set_verts(faces)
        time_text.set_text(f"time = {t[frame]:.2f} [s]")
        return poly, time_text

    FuncAnimation(fig, update, frames=len(euler_deg), interval=20, blit=False, repeat=False)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Single-file IMU 9-axis EKF post-processing")
    parser.add_argument(
        "--input",
        type=str,
        default="../IMU_Kalman-filter_MATLAB/IMU_Kalman-filter/sampledata.txt",
        help="Path to sample data txt (10 columns).",
    )
    parser.add_argument("--no-animation", action="store_true", help="Disable 3D animation.")
    return parser.parse_args()


def api_usage_example() -> None:
    """Minimal example for calling this module like an API from another file."""
    api = IMU9AxisEKFAPI()
    sample_raw_9 = np.array([648, 396, 17284, 369, -68, -38, -17, -23, -25], dtype=float)
    out = api.process_sample(sample_raw_9, time_ms=33)
    print("corrected_9:", out["corrected_9"])


def main() -> None:
    args = parse_args()
    cfg = EKFConfig()

    data_path = Path(args.input).resolve()
    if not data_path.exists():
        raise FileNotFoundError(f"Input file not found: {data_path}")

    data_raw = load_data(data_path)
    n_samples = data_raw.shape[0]
    if n_samples < 3:
        raise ValueError("Need at least 3 rows of IMU data.")

    data_si = convert_to_si(data_raw, cfg)
    data_si, bias_gyro = compensate_gyro_bias(data_si, cfg)
    data_si, bias_mag = compensate_mag_hardiron(data_si, cfg)
    B = reference_magnetic_vector(data_si, cfg)

    euler_rad = run_ekf(data_si, B, cfg)
    euler_deg = np.rad2deg(euler_rad)

    print("Gyro bias [rad/s]:", bias_gyro)
    print("Mag bias [uT]:", bias_mag)
    print("Reference magnetic vector B:", B)

    plot_timeseries(data_si, euler_deg)
    if not args.no_animation:
        animate_imu(euler_deg, data_si[:-1, 9])
    plt.show()


if __name__ == "__main__":
    main()
