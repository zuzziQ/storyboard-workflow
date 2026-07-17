---
type: docs
title: AGENTS
description: OKF standardized document for AGENTS in project flow-architect.
tags: [flow-architect]
related_files: [file:////Users/imam/storymee/1-Harness-Apps/flow-architect/.agents/AGENTS.md]
---

# Session Log: Last Frame Extraction Feature Implementation

Date: 2026-06-27
Conversation ID: 4714de8a-ea93-4058-a1a0-e4a87ff2622b

## 1. Vị trí của nút trong giao diện:
Nút này nằm ở **khung phát video** trong cửa sổ biên tập chi tiết Shot ở cả 2 chế độ:
- **Chế độ Shot Planner (Canvas)**: Bấm vào một Shot node để mở modal Biên tập chi tiết Shot -> chọn tab **Dựng Video** -> Nút màu xanh indigo **"🪄 Lấy frame cuối cho Shot sau"** sẽ xuất hiện ở góc dưới bên phải khung video.
- **Chế độ Bảng (Table view)**: Click vào dòng bất kỳ của Shot để mở panel chi tiết bên phải -> chọn tab **Dựng Video** -> Nút màu xanh indigo **"🪄 Lấy frame cuối cho Shot sau"** sẽ xuất hiện ở góc dưới bên phải khung video.

## 2. Kết quả biên dịch:
- Chạy `npm run build` ở frontend `flow-architect` thành công 100% không gặp lỗi typecheck hay import nào.
