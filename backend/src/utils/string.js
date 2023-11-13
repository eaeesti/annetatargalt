function urlWithParams(url, params) {
  return `${url}?${new URLSearchParams(params)}`;
}

module.exports = {
  urlWithParams,
};
