import { extend, RequestOptionsInit } from 'umi-request';

function identity<T>(args: T): T {
  return args;
}

function nop(...args: any[]) {}

// 标准返回 ( 假定总是返回response.httpStatus = 200)
interface Result<T = any> {
  code: number; // 所以使用code放真实的httpStatus: 200| 201| 400 | 404 | 403
  data?: T; // {user: [1,2]}
  errorCode?: string; // 业务级错误码(如ProductNotExists), 一般只使用errorMsg
  errorMsg?: string; // 仅code不为200/201时生效
}

interface ConfigProps {
  // 前缀. 比如request('/users'), 而prefix=http://localhost:3000/api
  // 那么真实url为http://localhost:3000/api/users
  prefix?: string;

  // 设置了就开启缓存, max是最大缓存个数, ttl是过期时间
  cache?: { max: number; ttl: number } | false;

  // 将用户自己的数据标准化为Result, 从而屏蔽不同服务端的影响
  normalize?: (result: any, status?: number) => Result;

  // 请求超时, 默认15秒
  timeout?: number;

  // 在header中写入token
  setToken?: () => Record<string, string>;

  // 请求开始和结束时的hook, 例如可用之实现loading状态获取
  beforeRequest?: VoidFunction;
  afterResponse?: VoidFunction;

  // 全局错误处理
  // 1. 发生错误时的处理, 例如可用之显示一个错误提示
  onError?: (e: Result) => void;
  // 2. 当httpStatus!==2xx时, 显示的错误提示
  // 当然, 你也可以选择由onError自行处理, 比如展示新的404页面. 这种情况下, 实际上此方法无用
  getMsgByHttpStatus?: (code: number) => string;
  // 3. 针对业务级错误, 一般直接使用errorMsg
  // 但如果你在前端维护了一个错误码映射表, 那么可以通过此方法查取错误信息, 覆盖errorMsg
  getMsgByBizCode?: (errorCode: string | null) => string;
}
function getRequest(props: ConfigProps) {
  const {
    prefix = '/api',
    cache = false,
    normalize = identity,
    timeout = 15000,
    setToken = () => {
      const token = localStorage.getItem('token');
      return { Authorization: `Bearer ${token}` };
    },
    beforeRequest = nop,
    afterResponse = nop,
    onError = nop,
    getMsgByHttpStatus = nop,
    getMsgByBizCode = nop
  } = props;
  const request = extend({
    prefix,
    useCache: !!cache,
    timeout,
    headers: setToken(),
    maxCache: cache && cache.max ? cache.max : 0,
    ttl: cache && cache.ttl ? cache.ttl : 60000
  });

  // 由于interceptor的限制, 不方便在中间件中修改 response, 只好通过 promise 方式处理
  return (url: string, _options: RequestOptionsInit = {}) => {
    beforeRequest();
    const options = {
      ..._options,
      headers: { ..._options.headers, ...setToken() }
    };
    return request(url, options)
      .then(result => {
        const newResult = normalize(result) as Result;
        // 可能情况1: 后台返回的状态码均为200, 错误写在result里
        // 判断返回值是否有异常 (code = 200 || 201 ?)
        const httpStatusError =
          newResult.code !== undefined && newResult.code - 200 >= 100;
        const bizError = newResult.errorCode || newResult.errorMsg;
        if (httpStatusError || bizError)
          throw { from: 'response', result: newResult };
        afterResponse();
        return newResult;
      })
      .catch(e => {
        afterResponse();
        // 可能情况0: 超时错 ( 此时没有response, 往下执行可能出错 )
        if (
          e.name === 'RequestError' &&
          (e.message || '').startsWith('timeout')
        ) {
          const errorResult = {
            code: 502,
            errorMsg: '网络请求超时, 请稍后重试'
          };
          onError(errorResult);
          throw errorResult;
        }

        if (e.name === 'TypeError' && e.message === 'Network request failed') {
          const errorResult = {
            code: 1000,
            errorMsg: '断网了, 请检查网络'
          };
          onError(errorResult);
          throw errorResult;
        }

        // 可能情况1: 2: 后台返回的状态码为200 | 201, 但业务码出错
        if (e.from === 'response') {
          const newResult = {
            ...e.result,
            errorMsg:
              getMsgByBizCode(e.result.errorCode || null) || e.result.errorMsg
          };
          onError(newResult);
          throw newResult;
        }

        // 可能情况2, 后台返回的状态码不为 2xx
        const normalizedResult =
          e.from === 'response'
            ? e.result
            : (normalize(e.data, e.response.status) as Result);
        const errorResult = {
          ...normalizedResult,
          errorMsg:
            getMsgByHttpStatus(normalizedResult.code) ||
            getMsgByBizCode(normalizedResult.errorCode || null) ||
            normalizedResult.errorMsg,
          code: e.response.status
        };
        onError(errorResult);
        throw errorResult;
      });
  };
}

export default getRequest;
