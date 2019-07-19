const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());

// 正常数据
app.get('/users', (req, res) => res.send({ code: 200, data: { users: [1] } }));

// 错误数据
app.get('/users_error', (req, res) =>
  res.send({ code: 300, errorMsg: 'error!' })
);

// 需要前端提供normalize方法
app.get('/users_not_normalized', (req, res) => {
  res.send({ xcode: 200, xdata: 3 });
});
app.get('/users_not_normalized_error_300', (req, res) => {
  res.send({ xcode: 300, errorMsg: 'error!' });
});

app.get('/users_with_status_403', (req, res) => {
  res.status(403).send({ errorMsg: 'error!' });
});

app.listen(3001);
