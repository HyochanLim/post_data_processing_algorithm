import json
from pathlib import Path

import numpy as np

from imu9_ekf_single_file import EKFConfig, IMU9AxisEKFAPI

RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"
raw_files = sorted(RAW_DIR.glob("*.json"))

if raw_files:
	with raw_files[-1].open("r", encoding="utf-8") as f:
		flightData = json.load(f)
else:
	flightData = []

totalFramesIndex = len(flightData) - 1 # 객체 기준 프레임의 인덱싱 번호

# RAW JSON uses SI-like units. Configure API conversion to match these values.
ekf_api = IMU9AxisEKFAPI(
	cfg=EKFConfig(
		g=9.81,
		unit_transform_acc=9.81,
		unit_transform_gyro=np.pi / 180.0,
		unit_transform_mag=1.0,
	)
)


def quaternion_to_rotmat(quaternion):
	q0, q1, q2, q3 = [float(v) for v in quaternion]
	return np.array([
		[1.0 - 2.0 * (q2 * q2 + q3 * q3), 2.0 * (q1 * q2 - q0 * q3), 2.0 * (q1 * q3 + q0 * q2)],
		[2.0 * (q1 * q2 + q0 * q3), 1.0 - 2.0 * (q1 * q1 + q3 * q3), 2.0 * (q2 * q3 - q0 * q1)],
		[2.0 * (q1 * q3 - q0 * q2), 2.0 * (q2 * q3 + q0 * q1), 1.0 - 2.0 * (q1 * q1 + q2 * q2)],
	], dtype=float)


def calculateVelocity(flightData, frameIndex):
	frame = flightData[frameIndex]
	raw_9 = np.array([
		frame.get("accel_x", 0.0), frame.get("accel_y", 0.0), frame.get("accel_z", 0.0),
		frame.get("gyro_roll", 0.0), frame.get("gyro_pitch", 0.0), frame.get("gyro_yaw", 0.0),
		frame.get("mag_x", 0.0), frame.get("mag_y", 0.0), frame.get("mag_z", 0.0),
	], dtype=float)

	time_s = float(frame.get("time", 0.0))
	api_out = ekf_api.process_sample(raw_9, time_ms=time_s * 1000.0)
	frame["attitude_quaternion"] = np.asarray(api_out["quaternion"], dtype=float).tolist()

	if frameIndex == 0:
		flightData[frameIndex]["velocity"] = [0.0, 0.0, 0.0]  # 초기 속도는 0으로 가정해보기
		return

	previousFrameIndex = frameIndex - 1
	previousVelocity = flightData[previousFrameIndex].get("velocity", [0.0, 0.0, 0.0])
	dt = time_s - float(flightData[previousFrameIndex].get("time", time_s))
	if dt <= 0.0:
		flightData[frameIndex]["velocity"] = previousVelocity
		return

	accel_body = np.asarray(api_out["corrected_9"][0:3], dtype=float)
	rot_body_to_world = quaternion_to_rotmat(api_out["quaternion"])
	g_world = np.array([9.81, 0.0, 0.0], dtype=float)
	g_body = rot_body_to_world.T @ g_world
	linear_accel_body = accel_body - g_body

	flightData[frameIndex]["velocity"] = (
		np.asarray(previousVelocity, dtype=float) + linear_accel_body * dt
	).tolist()
	return

for frame in range(totalFramesIndex + 1):
	calculateVelocity(flightData, frame)

if raw_files:
	with raw_files[-1].open("w", encoding="utf-8") as f:
		json.dump(flightData, f, ensure_ascii=False, indent=2)