function clampFrameIndex(frame, length) {
    return Math.max(0, Math.min(Number(frame) || 0, length - 1));
}

function toTelemetry(frameData) {
    const safeFrame = frameData || {};
    const vx = Number(safeFrame?.velocity?.[0] ?? 0);
    const vy = Number(safeFrame?.velocity?.[1] ?? 0);
    const vz = Number(safeFrame?.velocity?.[2] ?? 0);
    const ax = Number(safeFrame?.accel_x ?? 0);
    const ay = Number(safeFrame?.accel_y ?? 0);
    const az = Number(safeFrame?.accel_z ?? 0);

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
        prograde: toPrograde(frameData, minVelocityMagnitude)
    };
}

module.exports = {
    getFrameState,
    toTelemetry
};