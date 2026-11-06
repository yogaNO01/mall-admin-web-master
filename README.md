# Mall 管理后台前端

本项目是商城管理后台前端，基于 Vue 3、TypeScript、Vite、Element Plus 和 Pinia 构建。

## 功能模块

- 商品、品牌、分类和库存管理
- 订单、会员和营销管理
- 内容、权限和系统设置
- 中文、葡萄牙语等多语言界面
- 管理员登录、权限控制和操作日志

## 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本

## 本地运行

```bash
npm install
npm run dev
```

开发服务器启动后访问终端提示的地址。

## 构建发布

```bash
npm run build
```

构建产物位于 `dist` 目录，将其中的文件部署到 Nginx 或其他静态 Web 服务器即可。

## 接口配置

生产环境接口地址在 `.env.production` 中配置：

```env
VITE_APP_BASE_API=/admin-api
```

线上由 Nginx 将 `/admin-api/` 转发到商城后台服务 `mall-admin`。开发环境可在 `.env.development` 中配置本地后台地址。

## 目录结构

```text
src/
├── api/          接口请求
├── assets/       静态资源
├── components/   通用组件
├── layout/       页面布局
├── router/       路由配置
├── store/        Pinia 状态管理
├── styles/       全局样式
├── views/        业务页面
└── utils/        工具函数
```

## 部署说明

```bash
npm install
npm run build
```

将 `dist` 目录内容上传到服务器后台网站目录，然后重新加载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

后台前端需要配合商城服务端的 `mall-admin` 接口运行。服务端健康检查地址通常为：

```text
http://127.0.0.1:8080/actuator/health
```

## 许可证

本项目的使用和发布遵循仓库中的许可证文件。
