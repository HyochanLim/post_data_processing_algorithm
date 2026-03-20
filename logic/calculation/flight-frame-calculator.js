function clampFrameIndex(frame, length) {
    return Math.max(0, Math.min(Number(frame) || 0, length - 1));
}

function toTelemetry(frameData) {
    const safeFrame = frameData || {};
    const vx = Number(safeFrame?.velocity?.[0] ?? 0);
    const vy = Number(safeFrame?.velocity?.[1] ?? 0);
    const vz = Number(safeFrame?.velocity?.[2] ?? 0);
    const filteredAccel = safeFrame?.acceleration_body;
    const ax = Number(filteredAccel?.[0] ?? safeFrame?.accel_x ?? 0);
    const ay = Number(filteredAccel?.[1] ?? safeFrame?.accel_y ?? 0);
    const az = Number(filteredAccel?.[2] ?? safeFrame?.accel_z ?? 0);

    return {
        time: Number(safeFrame?.time ?? 0),
        velocity: { x: vx, y: vy, z: vz },
        speed: Math.sqrt((vx * vx) + (vy * vy) + (vz * vz)),
        accel: { x: ax, y: ay, z: az },
        accelMagnitude: Math.sqrt((ax * ax) + (ay * ay) + (az * az))
    };
}

function toPrograde(frameData, minVelocityMagnitude) {
    const velocity = frameData?.velocity;
    if (!Array.isArray(velocity) || velocity.length < 3) {
        return {
            visible: false,
            direction: { x: 0, y: 0, z: 0 }
        };
    }

    const vx = Number(velocity[0]) || 0;
    const vy = Number(velocity[1]) || 0;
    const vz = Number(velocity[2]) || 0;

    // Swap X/Y from raw frame to match viewer axis convention.
    const viewerX = vy;
    const viewerY = vx;
    const viewerZ = vz;
    const magnitude = Math.sqrt((viewerX * viewerX) + (viewerY * viewerY) + (viewerZ * viewerZ));

    if (magnitude < minVelocityMagnitude) {
        return {
            visible: false,
            direction: { x: 0, y: 0, z: 0 }
        };
    }

    return {
        visible: true,
        direction: {
            x: viewerX / magnitude,
            y: viewerY / magnitude,
            z: viewerZ / magnitude
        }
    };
}

function toNoseDirection(frameData) {
    const q = frameData?.attitude_quaternion;
    if (!Array.isArray(q) || q.length < 4) {
        return {
            valid: false,
            direction: { x: 0, y: 1, z: 0 }
        };
    }

    const q0 = Number(q[0]) || 0;
    const q1 = Number(q[1]) || 0;
    const q2 = Number(q[2]) || 0;
    const q3 = Number(q[3]) || 0;
    const norm = Math.sqrt((q0 * q0) + (q1 * q1) + (q2 * q2) + (q3 * q3));
    if (norm <= 0) {
        return {
            valid: false,
            direction: { x: 0, y: 1, z: 0 }
        };
    }

    const w = q0 / norm;
    const x = q1 / norm;
    const y = q2 / norm;
    const z = q3 / norm;

    const dirX = (2 * ((x * y) - (w * z)));
    const dirY = (1 - (2 * ((x * x) + (z * z))));
    const dirZ = (2 * ((y * z) + (w * x)));
    const mag = Math.sqrt((dirX * dirX) + (dirY * dirY) + (dirZ * dirZ));
    if (mag <= 0) {
        return {
            valid: false,
            direction: { x: 0, y: 1, z: 0 }
        };
    }

    return {
        valid: true,
        direction: {
            x: dirX / mag,
            y: dirY / mag,
            z: dirZ / mag
        }
    };
}

function getFrameState(file, frame, minVelocityMagnitude) {
    if (!Array.isArray(file) || file.length === 0) {
        return {
            hasData: false,
            frameIndex: 0,
            telemetry: toTelemetry({}),
            prograde: {
                visible: false,
                direction: { x: 0, y: 0, z: 0 }
            }
        };
    }

    const frameIndex = clampFrameIndex(frame, file.length);
    const frameData = file[frameIndex] || {};

    return {
        hasData: true,
        frameIndex,
        telemetry: toTelemetry(frameData),
        nose: toNoseDirection(frameData),
        prograde: toPrograde(frameData, minVelocityMagnitude)
    };
}

module.exports = {
    getFrameState,
    toTelemetry
};