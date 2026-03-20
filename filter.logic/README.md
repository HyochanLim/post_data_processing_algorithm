ArduPilot EKF3-like filter.logic package

What this includes
- Quaternion integration and correction from IMU
- Drift correction from GPS position and GPS-derived velocity
- Optional vertical correction from barometric altitude
- Outputs for velocity, acceleration, quaternion, and position

How close to ArduPilot
- Same EKF flow style: IMU prediction + measurement correction.
- Same nominal state layout style: position, velocity, quaternion, gyro bias, accel bias.
- Same error-state covariance style: 15x15 covariance with linearized predict/update.
- Reduced scope compared to full AP_NavEKF3: no multi-lane selector, no full 24-state set,
  and no all-sensor source switching logic.

Files
- nav_filter.py: standalone minimal EKF-style implementation
- process_raw_json.py: runner for data/raw/*.json
- ardupilot_source/: copied original ArduPilot EKF3/AP_Math source files

Strict original-math path
- If you must keep ArduPilot math untouched, use files under ardupilot_source/ as source-of-truth.
- See ardupilot_source/USAGE.md for replay-based execution notes.

Run
1) from workspace root
2) python filter.logic/process_raw_json.py

Output
- data/processed/<raw-file-name>-filtered.json
