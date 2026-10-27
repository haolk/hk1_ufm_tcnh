# Góc ôn tập 5 môn

Website ôn tập bằng tiếng Việt, mở trực tiếp, không cần đăng nhập. Chạy bằng HTML, CSS và JavaScript thuần. Không cần API key, cơ sở dữ liệu, npm hoặc bước build để triển khai.

Có 5 tab môn học, tìm kiếm có dấu/không dấu trong từng môn, bộ lọc theo chương và dạng nội dung, tô sáng từ khóa, đánh dấu, ẩn/hiện đáp án và xem tài liệu gốc. Đã kèm đủ 7 tài liệu cùng 1.483 mục tra cứu, trong đó có 1.298 câu hỏi.

## Đưa lên GitHub Pages

1. Giải nén file ZIP này.
2. Tạo repository mới trên GitHub, ví dụ `goc-on-tap`. Có thể chọn Public nếu dùng GitHub Free.
3. Chọn **Add file → Upload files**. Tải lên toàn bộ nội dung BÊN TRONG thư mục `goc-on-tap-github`, rồi Commit vào nhánh `main`. Cần thấy thư mục `docs` ngay ở cấp gốc repository; không tải nguyên file ZIP và không lồng thêm một thư mục bao ngoài.
4. Mở **Settings → Pages**.
5. Tại **Build and deployment → Source**, chọn **Deploy from a branch**.
6. Chọn nhánh **main**, thư mục **/docs**, rồi bấm **Save**.
7. Khi GitHub hoàn tất triển khai, mở đường dẫn được hiển thị trong Settings → Pages.

Không cần cấu hình GitHub Actions riêng. Mỗi lần cập nhật file trong `docs` và commit vào `main`, GitHub sẽ triển khai lại. Đường dẫn tài nguyên dùng dạng tương đối, hỗ trợ cả địa chỉ theo repository và tên miền riêng.

Website và tài liệu đi kèm sẽ được người truy cập xem/tải mà không cần đăng nhập. Bản xuất này không có lớp đăng nhập ChatGPT của bản được lưu trên Sites. Dấu trang và tiến độ lưu riêng trong trình duyệt, chưa đồng bộ giữa các thiết bị.

Tài liệu chính thức: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Chạy thử trên máy

Tại thư mục dự án, chạy:

```bash
python3 -m http.server 8000 --directory docs
```

Mở http://localhost:8000. Không mở `index.html` trực tiếp bằng `file://` vì trình duyệt có thể chặn việc tải JSON và JavaScript modules.

## Cấu trúc và chỉnh sửa

| Đường dẫn | Nội dung |
|---|---|
| `docs/index.html` | Khung trang và các tab |
| `docs/style.css` | Giao diện máy tính và điện thoại |
| `docs/app.mjs` | Chọn môn, bộ lọc, cửa sổ đọc và lưu tiến độ |
| `docs/search.mjs` | Tìm kiếm không dấu và tô sáng từ khóa |
| `docs/content.json` | Dữ liệu 5 môn, câu hỏi, lý thuyết và lời giải |
| `docs/sources/` | 7 tài liệu PDF/Word gốc được cung cấp |
| `docs/pages/` | Ảnh trang gốc cho công thức, bảng và đồ thị Kinh tế vĩ mô |
| `scripts/build_content.py` | Tạo lại dữ liệu từ bộ tài liệu hiện có |
| `scripts/verify.mjs` | Kiểm tra số lượng, tìm kiếm, bộ lọc và tài nguyên |

Để chỉnh nội dung nhỏ, sửa `docs/content.json` và giữ nguyên `id` để không mất liên kết dấu trang. Các trường `title`, `titleHtml`, `bodyHtml`, `answerHtml`, `noteHtml` và `text` phải nhất quán; `text` là nội dung dùng để tìm kiếm. HTML trong dữ liệu phải đến từ nguồn đáng tin cậy. Không đưa HTML hoặc script của người lạ vào dữ liệu.

Để tạo lại từ bộ PDF/Word đi kèm, dùng môi trường Python riêng:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/build_content.py
node scripts/verify.mjs
```

Trên Windows, kích hoạt bằng `.venv\Scripts\activate`. Script ưu tiên tài liệu có tên gốc trong `input/` nếu bạn bổ sung, sau đó dùng bản đã có trong `docs/sources/`. Bộ phân tích được thiết kế theo cấu trúc 7 tài liệu hiện tại; tài liệu mới hoặc bố cục khác cần chỉnh bộ phân tích.

Các đáp án và lưu ý giữ theo tài liệu đã cung cấp. 14 câu được đánh dấu cần đối chiếu; bộ lọc cũng chứa một ghi chú tổng hợp, nên hiển thị 15 mục. Việc xuất website không phải xác nhận lại toàn bộ đáp án học thuật.
