# Interactive Verification Report

#### 介绍

用于交互式验证报告的处理框架，支持动态加载数据处理器和交互器代码，实现多线程并行处理加密验证报告。

**核心特性：**
- 动态加载 JavaScript 代码模块（VRDataProcessor、VRInteractor）
- 基于 Worker Threads 的多线程并行处理
- 安全的报告解密和处理流程
- RESTful API 接口支持
- 同时支持桌面端（Electron）和服务器端部署
- 支持多种文件类型处理（.data、.zip、.pdf、.json、.txt）

**技术栈：**
- Node.js 20+
- Express 4.x
- Worker Threads
- @yeez-tech/meta-encryptor
- SQLite3
- pdf-parse（PDF解析）
- unzipper（ZIP解压）

---

#### 安装教程

使用 npm：
```bash
npm install @yeez-tech/interactive-verification-report --save
```

使用 yarn：
```bash
yarn add @yeez-tech/interactive-verification-report
```

---

#### 快速开始

**1. 安装依赖**
```bash
yarn install
```

**2. 启动演示服务器**
```bash
yarn example
```
访问：http://localhost:5051/index.html

**3. 运行测试**
```bash
yarn test
```

---

#### 核心概念

| 组件 | 说明 |
|------|------|
| **VRDaemon** | 核心守护进程，管理 HTTP 服务和工作线程池 |
| **WorkerPool** | 线程池管理器，实现任务队列和负载均衡 |
| **TaskProcessor** | 工作线程中的任务处理器，负责解密和处理报告 |
| **VRDataProcessor** | 用户自定义数据处理模块，解析验证报告并提取元数据 |
| **VRInteractor** | 用户自定义交互模块，根据请求参数返回不同格式响应 |
| **MetaProvider** | 元数据提供者接口，定义元数据获取逻辑 |
| **FileProcessor** | 文件处理器，支持多种文件类型解析 |

---

#### 使用方法

##### 初始化 VRDaemon

```javascript
import { init_vrdaemon, process_verfication_report, close_vrdaemon } from "@yeez-tech/interactive-verification-report";

// 初始化
init_vrdaemon(meta_provider, port, storage_context, meta_data_dir);

// 参数说明：
// - meta_provider: 继承自 MetaProvider 的实例
// - port: HTTP 服务监听端口
// - storage_context: 存储上下文配置
// - meta_data_dir: 元数据存储目录
```

##### 关闭 VRDaemon

```javascript
close_vrdaemon();
```

##### 处理验证报告

```javascript
await process_verfication_report(request_hash, encrypted_report_path, callback);
```

---

#### API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/report` | GET | 获取验证报告内容 |
| `/api/list` | GET | 列出所有可用报告 |
| `/api/meta` | GET | 获取指定报告的元数据 |
| `/api/upload` | POST | 上传并处理报告文件 |
| `/api/process` | POST | 处理已存在的加密报告文件 |
| `/api/generate-report` | POST | 生成完整验证报告 |

**GET /api/report 参数：**
- `request_hash` (必填): 验证报告的唯一标识
- `params` (可选): JSON 格式的附加参数（如 `{"format":"json"}`）

---

#### 支持的文件类型

| 文件类型 | 扩展名 | 处理方式 |
|----------|--------|----------|
| 加密报告 | `.data` | 解密后处理 |
| 压缩文件 | `.zip` | 解压并列出所有文件 |
| PDF文档 | `.pdf` | 提取文本和元数据 |
| JSON数据 | `.json` | 解析并格式化显示 |
| 文本文件 | `.txt` | 直接读取显示 |

---

#### 扩展开发

##### 自定义 VRDataProcessor

创建数据处理器文件：
```javascript
// my_processor.js
function process_report(storage_context, enclave_hash, request_hash, report_path) {
    const data = fs.readFileSync(report_path, 'utf-8');
    return {
        enclave_hash,
        request_hash,
        data
    };
}

module.exports = process_report;
```

##### 自定义 VRInteractor

创建交互器文件：
```javascript
// my_interactor.js
function parseParams(params) {
    if (typeof params === 'string') {
        try { return JSON.parse(params); }
        catch { return { raw: params }; }
    }
    return params || {};
}

module.exports = function(meta, storage, params) {
    const p = parseParams(params);
    if (p.format === 'json') {
        return { meta, params: p };
    }
    if (p.format === 'summary') {
        return { summary: '报告摘要', data_length: meta.data?.length };
    }
    return `<div>HTML 响应内容</div>`;
};
```

##### 实现 MetaProvider

```javascript
class MyMetaProvider {
    async getDataProcessorCode(enclave_hash) {
        return fs.readFileSync('./processors/' + enclave_hash + '.js', 'utf-8');
    }
    
    async getInteractorCode(enclave_hash) {
        return fs.readFileSync('./interactors/' + enclave_hash + '.js', 'utf-8');
    }
    
    async getShuPrivateKey() {
        return 'your_private_key';
    }
    
    async getEnclaveHash(request_hash) {
        return 'abcd';
    }
}
```

---

#### 项目结构

```
interactive-verification-report/
├── src/                    # 源代码目录
│   ├── VRDaemon.js         # 核心守护进程
│   ├── WorkerPool.js       # 线程池管理
│   ├── TaskProcessor.js    # 任务处理器（工作线程）
│   ├── ReportInteractorCode.js  # 代码缓存管理
│   ├── MetaProvider.js     # 元数据提供者接口
│   ├── StorageContext.js   # 存储上下文
│   ├── Util.js             # 工具函数
│   └── FileProcessor.js    # 文件处理器
├── example/                # 演示示例
│   ├── index.html          # 演示页面
│   ├── server.js           # 演示服务器
│   └── code/               # 示例交互器代码
├── test/                   # 测试文件
├── test_data/              # 测试数据
├── scripts/                # 辅助脚本
├── IVR.txt                 # 详细使用说明
└── package.json
```

---

#### 演示页面功能

演示页面 (http://localhost:5051/index.html) 提供以下功能：
- 🔍 加载和查看验证报告（输入 request_hash 自动加载）
- 📊 生成完整验证报告（点击「生成报告」按钮）
- 📋 多视图切换（HTML/JSON/元数据）
- 📁 文件上传（支持拖拽，支持多种文件类型）
- 📋 报告列表管理
- 🔔 实时通知系统

##### 可用测试数据

| request_hash | 描述 |
|--------------|------|
| `req_abcdefg` | 简单测试字符串 |
| `req_test_001` | 用户登录验证报告 |
| `req_test_002` | 交易报告 |
| `req_demo_report` | 中文安全验证报告 |
| `req_large_data` | 审计日志（50条记录） |

---

#### 测试

项目包含完整的测试套件：
- `VRDaemon.spec.js` - API 测试
- `WorkerPool.spec.js` - 线程池测试  
- `Util.spec.js` - 工具函数测试
- `ReportInteractorCode.spec.js` - 代码缓存测试
- `simple/SimpleTask.spec.js` - 集成测试

运行所有测试：
```bash
yarn test
```

---

#### 注意事项

1. **跨平台兼容性**：VRDataProcessor 和 VRInteractor 同时用于服务端和桌面端，需注意 StorageContext 的差异
2. **代码安全性**：动态加载外部代码存在安全风险，建议增加沙箱隔离
3. **内存管理**：代码缓存会自动清理（每分钟递减计数器，归零后删除）
4. **文件大小限制**：默认文件上传大小限制为 50MB

---

#### TODO

- [ ] 实现 VRDataProcessor 和 VRInteractor 的动态卸载机制
- [ ] 添加代码沙箱隔离机制
- [ ] 支持更多数据库后端
- [ ] 添加详细的性能监控

---

#### 版本

**v1.0.0**

---

#### 许可证

MIT License