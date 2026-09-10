# Chrome DevTools MCP và Playwright trong VS Code

Workspace này đã có [`.vscode/mcp.json`](../.vscode/mcp.json) với hai server MCP:

- `chrome-devtools`: kiểm tra console, network, DOM, trace và hiệu năng bằng Chrome DevTools.
- `playwright`: điều hướng và kiểm thử giao diện bằng accessibility snapshot, locator, keyboard, network và storage state.

Cấu hình mặc định dùng Chrome profile cô lập (`--isolated`). Mỗi server có phiên browser riêng, nên cookie và phiên đăng nhập Chrome cá nhân không bị gửi cho agent. MCP server là chương trình cục bộ có thể thực thi code; chỉ khởi động server sau khi xem lại cấu hình và xác nhận trust trong VS Code.

## Cài và khởi động trên Windows

1. Cài Node.js 20 trở lên và Chrome Stable.
2. Mở thư mục `ccna-master` bằng VS Code bản có hỗ trợ MCP.
3. Mở `Ctrl+Shift+P` → `MCP: List Servers`, chọn `chrome-devtools` và `playwright`, rồi chọn `Start`/`Trust` khi VS Code hỏi.
4. Mở Chat/Agent, bấm `Configure Tools` để bật các tool cần dùng. Khi sửa `mcp.json`, chạy `MCP: Restart Server` hoặc reload VS Code để server được khám phá lại.

Có thể xem log bằng `MCP: List Servers` → server → `Show Output`. Lần chạy đầu có thể mất thời gian vì `npx` tải package vào npm cache; không có dependency MCP nào được ghi vào `package.json` của ứng dụng.

Prompt kiểm tra nhanh:

```text
Dùng Playwright MCP mở http://localhost:3000, đọc accessibility snapshot và kiểm tra tiêu đề trang.
Sau đó dùng Chrome DevTools MCP kiểm tra console errors và các request thất bại.
```

Playwright phù hợp với thao tác UI và test theo role/label; Chrome DevTools phù hợp với console, network, performance trace và CSS/runtime inspection. Hai server trong cấu hình mặc định không dùng chung một browser context.

## Gắn vào một Chrome debug riêng

Chỉ dùng khi cần giữ phiên đăng nhập test trong một browser riêng. Không dùng profile Chrome hằng ngày. Đóng Chrome debug trước khi chạy lệnh sau trong PowerShell:

```powershell
$debugProfile = Join-Path $env:TEMP 'ccna-chrome-mcp'
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  '--remote-debugging-port=9222' `
  "--user-data-dir=$debugProfile"
```

Trong một bản sao cấu hình MCP cá nhân (không ghi credential vào repo), đổi server Chrome DevTools thành:

{
  "type": "stdio",
  "command": "npx",
  "args": [
    "-y",
    "chrome-devtools-mcp@latest",
    "--browser-url=http://127.0.0.1:9222"
  ]
}
```

Để Playwright gắn vào tab Chrome hiện tại, cài Playwright MCP browser extension theo tài liệu chính thức và đổi args server Playwright thành `@playwright/mcp@latest`, `--extension`. Khi mở remote debugging, port 9222 cho phép chương trình trên máy điều khiển browser; chỉ mở profile test riêng và không truy cập website chứa dữ liệu nhạy cảm.

## Troubleshooting

- Server không khởi động: kiểm tra Node 20+, chạy `npx.cmd --version`, mở `MCP: Show Output` và xem lỗi package/network.
- Không thấy tool: chạy `MCP: Restart Server`, bật server trong `MCP: List Servers` và kiểm tra `Configure Tools` trong Chat.
- Chrome debug không kết nối: đóng Chrome đang mở, dùng `--user-data-dir` khác profile mặc định và kiểm tra `http://127.0.0.1:9222/json/version`.
- VS Code Remote/Dev Container: đặt MCP ở môi trường remote nơi server cần chạy; `.vscode/mcp.json` được VS Code chuyển cho Agent Host, còn `.mcp.json` phù hợp khi cần cấu hình portable cho client khác.

Tham khảo chính thức: [VS Code MCP servers](https://code.visualstudio.com/docs/agent-customization/mcp-servers), [Playwright MCP trong VS Code](https://playwright.dev/mcp/clients/vscode), [Playwright MCP options](https://playwright.dev/mcp/configuration/options), [Chrome DevTools MCP](https://developer.chrome.com/docs/devtools/agents/get-started), [Chrome DevTools kết nối browser đang chạy](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/advanced-usage.md#connecting-to-a-running-chrome-instance).
