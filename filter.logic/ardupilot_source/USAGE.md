How to use original ArduPilot EKF3 logic

What is true
- The copied files are original math/logic code from ArduPilot EKF3.
- No formula rewrite was applied in these copied files.

What is also true
- These files are not standalone.
- AP_NavEKF3_core.h depends on many ArduPilot subsystems:
  - AP_Common, AP_Math, AP_NavEKF common, AP_DAL, AP_InertialSensor, AP_RangeFinder, etc.

Practical way to run original EKF3
1) Build ArduPilot Replay tool in the ArduPilot tree.
2) Feed DataFlash log to Replay.
3) Read EKF outputs from replay log.

Why this matters for your raw JSON
- Your current input is custom JSON (raw 9-axis + GPS + baro fields).
- Replay expects ArduPilot/DataFlash log format.
- So a converter is required if you want strict original EKF3 execution on your JSON.

Recommended pipeline
1) Keep raw JSON ingestion in this workspace.
2) Convert JSON -> DataFlash-like log format.
3) Run ArduPilot Replay (original EKF3 math untouched).
4) Parse replay output back to JSON for your viewer.
