export const preventingDefault = (callback) => {
  return (event) => {
    event.preventDefault();
    callback();
    return false;
  };
};

export const openPopup = (url, title) => {
  window.open(url, title, "toolbar=0,status=0,width=720,height=500");
};

// https://stackoverflow.com/a/61843371/12123296
export function fixedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
    return "%" + c.charCodeAt(0).toString(16);
  });
}

export const defer = (callback) => {
  setTimeout(callback, 100);
};

export const scrollSmoothlyTo = (element) => {
  element.scrollIntoView({ behavior: "smooth" });
};

export const range = (start, end) => {
  return Array(end - start)
    .fill(1)
    .map((x, y) => start + x + y);
};

const round = (number, digits = 0) => {
  return Math.round(number * 10 ** digits) / 10 ** digits;
};

export const sfround = (number, sigFigs) => {
  if (number === 0) return 0;
  const log10 = Math.log10(Math.abs(number));
  const digits = Math.max(0, sigFigs - Math.ceil(log10));
  return round(number, digits);
};
