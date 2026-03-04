import json
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
raw_files = sorted(RAW_DIR.glob("*.json"))

if raw_files:
	with raw_files[-1].open("r", encoding="utf-8") as f:
		flightData = json.load(f)
else:
	flightData = []

totalFramesIndex = len(flightData) - 1 # 객체 기준 프레임의 인덱싱 번호

# 일단 지금은 칼만필터가 구현이 안 됐기 때문에 단순 가속도를 적분해 속도를 구하도록 로직 작성
def calculateVelocity(flightData, frameIndex):
	if frameIndex == 0:
		flightData[frameIndex]["velocity"] = [0.0, 0.0, 0.0]  # 초기 속도는 0으로 가정해보기
		return
	previousFrameIndex = frameIndex - 1
	previousVelocity = flightData[previousFrameIndex].get("velocity", [0.0, 0.0, 0.0])
	dt = flightData[frameIndex]["time"] - flightData[previousFrameIndex]["time"]
	# 단순 적분
	flightData[frameIndex]["velocity"] = [
		previousVelocity[0] + (flightData[frameIndex]["accel_x"] * dt),
		previousVelocity[1] + (flightData[frameIndex]["accel_y"] * dt),
		previousVelocity[2] + (flightData[frameIndex]["accel_z"] * dt),
	]
	return

for frame in range(totalFramesIndex + 1):
	calculateVelocity(flightData, frame)

if raw_files:
	with raw_files[-1].open("w", encoding="utf-8") as f:
		json.dump(flightData, f, ensure_ascii=False, indent=2)