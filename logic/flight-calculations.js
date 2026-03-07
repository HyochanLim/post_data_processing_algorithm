function clampFrameIndex(frame, length) {
    if (!Number.isFinite(length) || length <= 0) return 0;
    const frameNumber = Number(frame) || 0;
    return Math.max(0, Math.min(frameNumber, length - 1));
}

function normalizeVector(x, y, z) {
    const magnitude = Math.sqrt((x * x) + (y * y) + (z * z));
    if (magnitude <= 0) {
        return {
            magnitude: 0,
            x: 0,
            y: 0,
            z: 0
        };
    }

    return {
        magnitude,
        x: x / magnitude,
        y: y / magnitude,
        z: z / magnitude
    };
}

function extractTelemetry(frameData) {
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
        acceleration: { x: ax, y: ay, z: az },
        accelerationMagnitude: Math.sqrt((ax * ax) + (ay * ay) + (az * az))
    };
}

function extractProgradeDirection(frameData, minVelocityMagnitude) {
    const safeFrame = frameData || {};
    const vx = Number(safeFrame?.velocity?.[0] ?? 0);
    const vy = Number(safeFrame?.velocity?.[1] ?? 0);
    const vz = Number(safeFrame?.velocity?.[2] ?? 0);

    // Raw data uses +X as forward. Viewer uses +Y as forward, so swap X/Y.
    const viewerVelocityX = vy;
    const viewerVelocityY = vx;
    const viewerVelocityZ = vz;
    const normalized = normalizeVector(viewerVelocityX, viewerVelocityY, viewerVelocityZ);

    if (normalized.magnitude < minVelocityMagnitude) {
        return {
            visible: false,
            speed: normalized.magnitude,
            direction: { x: 0, y: 0, z: 0 }
        };
    }

    return {
        visible: true,
        speed: normalized.magnitude,
        direction: {
            x: normalized.x,
            y: normalized.y,
            z: normalized.z
        }
    };
}

function buildFrameState(frames, frame, minVelocityMagnitude) {
    if (!Array.isArray(frames) || frames.length === 0) {
        return {
            hasData: false,
            frameIndex: 0,
            telemetry: extractTelemetry({}),
            prograde: {
                visible: false,
                speed: 0,
                direction: { x: 0, y: 0, z: 0 }
            }
        };
    }

    const frameIndex = clampFrameIndex(frame, frames.length);
    const frameData = frames[frameIndex];

    return {
        hasData: true,
        frameIndex,
        telemetry: extractTelemetry(frameData),
        prograde: extractProgradeDirection(frameData, minVelocityMagnitude)
    };
}

module.exports = {
    buildFrameState,
    clampFrameIndex,
    extractTelemetry,
    extractProgradeDirection
};