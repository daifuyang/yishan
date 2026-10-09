export default definePageConfig({
  navigationBarTitleText: "用户详情",
  navigationStyle: process.env.TARO_ENV === "h5" ? "custom" : "default",
});
