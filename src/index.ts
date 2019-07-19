import { extend, RequestOptionsInit } from 'umi-request';

function identity<T>(args: T): T {
  return args;
}

function nop(...args: any[]) {}

interface Result<T = any> {
  code: number; //200| 201| 400 | 404 | 403
  data?: T; // {user: [1,2]}
  errorMsg?: string; // 仅code不为200/201时生效
}

interface ConfigProps {
  prefix?: string;
  cache?: { max: number; ttl: number } | false;
  // 将用户自己的数据标准化为Result
  normalize?: (result: any) => Result;
  timeout?: number;
  setToken?: () => Record<string, string>;
  beforeRequest?: VoidFunction;
  afterResponse?: VoidFunction;
  onError?: (e: Result) => void;
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
    onError = nop
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
  return (url: string, options: RequestOptionsInit = {}) => {
    beforeRequest();
    return request(url, options)
      .then(result => {
        afterResponse();
        const newResult = normalize(result) as Result;
        // 可能情况1: 后台返回的状态码均为200, 错误写在result里
        // 判断返回值是否有异常 (code = 200 || 201 ?)
        if (
          newResult.code !== undefined &&
          [200, 201].indexOf(newResult.code) < 0
        )
          throw { from: 'response', result: newResult };
        return newResult;
      })
      .catch(e => {
        // 可能情况2: 后台返回的状态码不为200 | 201
        afterResponse();
        console.log('e::', e);
        if (e.from === 'response') {
          onError(e.result);
          throw e.result;
        }
        const errorResult = {
          ...(normalize(e.data) as Result),
          code: e.response.status
        };
        onError(errorResult);
        throw errorResult;
      });
  };
}

export default getRequest;
