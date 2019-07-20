import getRequest from '.';

describe('get Request', () => {
  const request1 = getRequest({
    prefix: 'http://localhost:3001'
  });
  it('正常get', async () => {
    const result = await request1('/users');
    expect(result).toEqual({ code: 200, data: { users: [1] } });
  });

  const request11 = getRequest({
    prefix: 'http://localhost:3001'
  });
  it('get到错误的http status', async () => {
    try {
      await request11('/users_error');
    } catch (e) {
      expect(e).toEqual({ code: 300, errorMsg: 'error!' });
    }
  });

  const request12 = getRequest({
    prefix: 'http://localhost:3001'
  });
  it('get到错误的biz code', async () => {
    try {
      await request12('/users_with_biz_error');
    } catch (e) {
      expect(e).toEqual({
        code: 200,
        errorCode: 'ProducNotFound',
        errorMsg: 'error!'
      });
    }
  });

  const request13 = getRequest({
    prefix: 'http://localhost:3001',
    getMsgByBizCode: (errorCode: string | null) =>
      errorCode ? errorCode + '!!!!' : ''
  });
  it('get到错误的biz code, 并转化为对应的msg', async () => {
    try {
      await request13('/users_with_biz_error');
    } catch (e) {
      expect(e).toEqual({
        code: 200,
        errorCode: 'ProducNotFound',
        errorMsg: 'ProducNotFound!!!!'
      });
    }
  });

  const request2 = getRequest({
    prefix: 'http://localhost:3001',
    normalize: (result: any) => ({ code: result.xcode, data: result.xdata })
  });
  it('normalize', async () => {
    const result = await request2('/users_not_normalized');
    expect(result).toEqual({ code: 200, data: 3 });
  });

  const request3 = getRequest({
    prefix: 'http://localhost:3001',
    normalize: (result: any) => ({
      code: result.xcode,
      data: result.xdata,
      errorMsg: result.errorMsg
    })
  });
  it('normalize and error', async () => {
    try {
      await request3('/users_not_normalized_error_300');
    } catch (e) {
      expect(e).toEqual({ code: 300, errorMsg: 'error!' });
    }
  });

  let e: any;
  const request4 = getRequest({
    prefix: 'http://localhost:3001',
    normalize: (result: any) => ({
      code: 200,
      data: result.xdata,
      errorMsg: result.errorMsg
    }),
    onError: e0 => {
      e = e0;
    }
  });
  it('normalize and error and status 403', async () => {
    try {
      await request4('/users_with_status_403');
    } catch (e) {
      expect(e).toEqual({ code: 403, errorMsg: 'error!', data: undefined });
    }
  });

  const x = { before: false, after: false };
  const request5 = getRequest({
    prefix: 'http://localhost:3001',
    beforeRequest: () => {
      x.before = true;
    },
    afterResponse: () => {
      x.after = true;
    }
  });
  it('beforeRequest, afterResponse', async () => {
    const result = await request5('/users');
    expect(x).toEqual({ before: true, after: true });
  });

  const y = { before: false, after: false };
  const request6 = getRequest({
    prefix: 'http://localhost:3001',
    normalize: (result: any) => ({
      code: result.xcode,
      data: result.xdata,
      errorMsg: result.errorMsg
    }),
    beforeRequest: () => {
      x.before = true;
    },
    afterResponse: () => {
      x.after = true;
    }
  });
  it('beforeRequest, afterResponse, on exception', async () => {
    try {
      await request6('/users_not_normalized_error_300');
      expect(y).toEqual({ before: true, after: true });
    } catch (e) {}
  });
});
