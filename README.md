# valor-request

基于`umi-request`的开箱即用的`request`库

## 用法示例

### 示例 1: 后端返回标准的 Result 结构

如果后端返回的格式如下( response.status 总是返回 200 ) :

```
interface Result<T = any> {
  code: number; //200| 201| 400 | 404 | 403
  data?: T; // {user: [1,2]}
  errorMsg?: string; // 仅code不为200/201时生效
}
```

比如在`nodejs`时这样写:

```
正常:
response.send({code: 200, data: {users: [1]}}});
错误: 用msg表示错误
response.send({code: 200, msg: '页面不存在'});
```

那么前端配置非常简单:

```
// rpc.ts
import getRequest from 'valor-request';
export default getRequest({
  prefix: 'http://localhost:3001/api',
})
```

使用时:

```
import request from './rpc';
function getUsers() {
  return request('/users');
}
```

### 示例 2: 后端用 http status 表示成功与失败

由于返回格式与`Result`格式不兼容, 需要进行转换(normalize):\
后端返回:

```
正常: 用data表示数据
response.send({data: {users: [1]}}});
错误: 用msg表示错误
response.status(404).send({msg: '页面不存在'});
```

前端配置:

```
// rpc.ts
import getRequest from 'valor-request';
export default getRequest({
  prefix: 'http://localhost:3001/api',
  normalize: (result:any)  => ({
    code: 200,   <== 统一设为200
    data: result.data,
    errorMsg: result.msg
  })
})
```

使用:

```
import request from './getRequest';
function getUsers() {
  return request('/users');
}
```

### 示例 3: 后端返回的 http status 永远为 200, 用 result.code 表示成功与失败

此种情形与`valor-request`假设一致, 但可能字段名称与`Result`不匹配, 同样需要进行转换(normalize):\
后端返回:

```
正常:
response.send({xcode: 200, xdata: {users: [1]}}});
错误: 用msg表示错误
response.send({xcode: 200, xmsg: '页面不存在'});
```

前端配置:

```
// rpc.ts
import getRequest from 'valor-request';
export default getRequest({
  prefix: 'http://localhost:3001/api',
  normalize: (result:any)  => ({
    code: result.xcode,   <== 统一设为200
    data: result.xdata,
    errorMsg: result.xmsg
  })
})
```

### 示例 4: 添加错误处理与 loading 状态

前端配置:

```
// rpc.ts
import getRequest from 'valor-request';
import uiStore from './UIStore';
export default getRequest({
  prefix: 'http://localhost:3001/api',
  onError: (e) => uiStore.addMsg(e.errorMsg),
  beforeRequest: () => uiStore.setLoading(true),
  afterRequest: () => uiStore.setLoading(false)
})
```

### 示例 5: 配置写 token 的方法

默认写入`headers: {Authorization: Bearer ${token}}`\
默认`token`从`localStorage.getItem('token')`读取\
如果跟实际情况不一致, 请使用如下方式覆盖:

```
import getRequest from 'valor-request';
export default getRequest({
  setToken() {
    const token = localStorage.getItem('jwttoken');
    return {token};
  }
})
```

---

## 动机

每个项目, 总是要造一个`request`轮子\
无论你使用`axios`, 还是最简单的`fetch`, 或是`umi-request`, 你总得考虑以下问题:

- `token`如何整合
- 如何处理错误处理, 错误是留到上层处理, 还是底层处理
- `loading`状态要在底层处理, 还是由调用者自行处理
- 后台应该返回`status`状态码, 还是全部返回`200`+`error-data`
- 如何将后台返回的数据结构, 与你的前台数据结构进行对应

进一步, 你可能还得考虑:

- 超时
- 缓存(对报表型的应用尤其重要)

所以干脆再造一个轮子, 目的是上手即用

## 特性

实际上, `valor-request`是一个统一的(微型)请求框架:

- 自动整合`token`到`request.header`
- 转换器: 实现前后台数据结构对应.
- 全局错误处理
- 请求生命周期 hook, 方便实现自己的 loading 状态管理
- 可设置请求超时
- 可实现`GET`型请求缓存

## 底层

基于[umi-request](https://github.com/umijs/umi-request)\
其实底层是什么都不重要, 选`umi-request`的原因是: 小而全(详见其官网对照表)\

## 用法

1. `yarn add valor-request`
2. 配置: 见下面的描述
3. 使用: 见上面的例子

### 基本配置

```
import getRequest from 'valor-request';
getRequest({
  // 在ajax型请求前面加上/api前缀
  prefix: '/api',
  // 显示loading状态
  beforeRequest: () => uiStore.showLoading(true),
  afterResponse: () => uiStore.showLoading(false),
  // 显示错误
  onError: (e) => uiStore.addError(e)
});
export default request;
```

注意如下的精简配置, 必须满足以下条件:

1. `token`来自`localStorage.getItem('token'),
2. `token`将保存为`request.header['Authorization']='Bearer ${token}'`
3. 后台返回数据结构:

```
type Result<T> {
  code: 200 | 403 | 404 |...;
  data?: T;
  errorMsg?: string;
}
```

这是目前比较通用的结构, 特点是:

- `response.status`总是`200`
- 错误码写在`result.code`里
- 一旦发生错误, 则`data`为`undefined`, `errorMsg`是中文错误信息
- 字段级错误可以通过将 json 字符串写在`errorMsg`里解决
- 不太符合 http 标准, 但在国内最常用

4. 请求超时`10秒`
5. 无`cache`

### Result 转换

```
getRequest({
  normalize: (后台返回的result格式) => Result
})
```

参见前面的例子.\
总之, 你得保证最后得到的`Result`刚好是`valor-request`的标准`Result`

### 错误处理

```
getRequest({
  onError(error:Result) => ...
})
```

注意这里收到的`error`, 是已转化为`Result`格式的!\

### 超时

```
getRequest({
  timeout: 5000
})
```

### 开启缓存

```
getRequest({
  cache: {max/*最多缓存记录*/, ttl/*缓存超时*/}
})
```

### 覆盖其它继承自`umi-request`的配置项

暂时只能一次性覆盖, 直到找到需要永久覆盖的场景:

```
import request from './rpc';
request(umi-request配置项).then(...)
```
