1. 健康检查
项目	内容
接口名称	健康检查
请求方法	GET
请求类型	-
请求参数	无
响应示例	{ "ok": true, "time": "2026-04-26T07:42:00.000Z" }

2. 登录
项目	内容
接口名称	登录
请求方法	POST
请求类型	application/json
请求参数	{"username": "张三", "password": "123"}
响应示例	{ "token": "eyJhbGciOiJIUzI1NiIs...", "tokenType": "Bearer" }

3. 验证Token
项目	内容
接口名称	验证Token
请求方法	GET
请求类型	-
请求参数	Header: Authorization: Bearer <token>
响应示例	{ "ok": true, "user": { "sub": "张三", "username": "张三" } }

4. 获取文档列表
项目	内容
接口名称	获取文档列表
请求方法	GET
请求类型	-
请求参数	无
响应示例	{ "items": [{ "id": "doc_1", "title": "标题", "createdAt": "2026-04-26T07:42:00Z", "updatedAt": "2026-04-26T07:42:00Z", "meta": {} }] }

5. 创建文档
项目	内容
接口名称	创建文档
请求方法	POST
请求类型	application/json
请求参数	{"title": "我的文章", "content": "<p>正文</p>", "meta": {"作者": "张三"}}
响应示例	{ "item": { "id": "new_id", "title": "我的文章", "content": "<p>正文</p>", "createdAt": "2026-04-26T07:42:00Z", "updatedAt": "2026-04-26T07:42:00Z", "meta": { "作者": "张三" } } }

6. 获取单个文档
项目	内容
接口名称	获取单个文档
请求方法	GET
请求类型	-
请求参数	URL参数: id (文档ID)
响应示例	{ "item": { "id": "doc_1", "title": "标题", "content": "内容", "createdAt": "2026-04-26T07:42:00Z", "updatedAt": "2026-04-26T07:42:00Z", "meta": {} } }

7. 更新文档
项目	内容
接口名称	更新文档
请求方法	PUT
请求类型	application/json
请求参数	URL参数: id (文档ID)
Body: {"title": "新标题", "meta": {"theme": "dark"}}
响应示例	{ "item": { "id": "doc_1", "title": "新标题", "content": "原内容", "createdAt": "...", "updatedAt": "...", "meta": { "theme": "dark" } } }

8. 删除文档
项目	内容
接口名称	删除文档
请求方法	DELETE
请求类型	-
请求参数	URL参数: id (文档ID)
响应示例	{ "ok": true }