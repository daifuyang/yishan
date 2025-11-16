import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useIntl, useModel, FormattedMessage } from "@umijs/max";
import { Alert, App, Button, Checkbox, Form, Input } from "antd";
import { createStyles } from "antd-style";
import React, { useState } from "react";
import { flushSync } from "react-dom";
import { login as userLogin, getCurrentUser } from "@/services/yishan-admin/auth";
import { saveTokens } from "@/utils/token";

const useStyles = createStyles(({ css }) => {
  return {
    root: {
      display: "flex",
      backgroundImage: "url('/images/login-bg.png')",
      backgroundSize: "cover",
      width: "100%",
      height: "100vh",
    },
    brand: {
      backgroundImage: "url('/images/login-brand.png')",
      backgroundSize: "100% 100%",
      width: "56.67%",
      height: "100%",
    },
    loginWrap: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    loginCard: {
      width: "481px",
      backgroundColor: "#fff",
      padding: "56px 48px 88px 48px",
      borderRadius: "20px",
      boxShadow:
        " 0px 0px 0px  rgba(0, 0, 0, 0.1), 0px 17px 36px  rgba(23, 57, 222, 0.25)",
    },
    loginTitle: {
      fontFamily: "Noto Sans SC",
      textAlign: "center",
      fontSize: "36px",
      fontWeight: 700,
      color: "#000",
    },
    loginSubTitle: {
      fontFamily: "Noto Sans SC",
      textAlign: "center",
      marginTop: "12px",
      fontSize: "14px",
      fontWeight: 400,
      color: "#000",
      margin: 0,
    },
    loginForm: {
      marginTop: "40px",
    },
    loginFormItem: css`
      background-color: rgba(231, 241, 253, 0.4);
      &.ant-input-affix-wrapper > input.ant-input {
        &::placeholder {
          font-size: 20px;
          color: rgba(4, 19, 74, 0.4);
          font-family: 'Noto Sans SC';
          font-weight: 400;
        }
        padding: 6px 8px;
        font-size: 20px;
        color: rgba(4, 19, 74, 0.4);
        font-family: 'Noto Sans SC';
        font-weight: 400;
      }
    `,
    loginItemIcon: {
      fontSize: "24px",
      color: "rgba(28, 53, 145, 0.6)",
    },
    loginFormChexkBox: css`
      & .ant-checkbox + span {
        color: rgba(4, 19, 74, 0.4);
        font-size: 20px;
        font-weight: 400;
      }
      margin-bottom: 86px;
    `,
    loginFormBtn: css`
      &.ant-btn {
        padding: 24px 15px;
        font-size: 20px;
      }
    `,
  };
});

const LoginMessage: React.FC<{
  content: string;
}> = ({ content }) => {
  return (
    <Alert
      style={{
        marginBottom: 24,
      }}
      message={content}
      type="error"
      showIcon
    />
  );
};

const Login: React.FC = () => {
  const [loginError, setLoginError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const { setInitialState } = useModel("@@initialState");
  const { styles } = useStyles();
  const { message } = App.useApp();
  const intl = useIntl();

  const fetchUserInfo = async () => {
    try {
      // 检查是否已经通过登录接口获取了用户信息
      const cachedUserInfo = localStorage.getItem("currentUser");
      if (cachedUserInfo) {
        try {
          const userData = JSON.parse(cachedUserInfo);
          flushSync(() => {
            setInitialState((s) => ({
              ...s,
              currentUser: userData,
            }));
          });
          // 清理缓存的用户信息
          localStorage.removeItem("currentUser");
          return userData;
        } catch (error) {
          console.warn("解析缓存用户信息失败:", error);
          localStorage.removeItem("currentUser");
        }
      }

      // 标准流程：通过用户信息接口获取
      const response = await getCurrentUser();
      if (response.success && response.data) {
        flushSync(() => {
          setInitialState((s) => ({
            ...s,
            currentUser: response.data,
          }));
        });
        return response.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const handleSubmit = async (values: API.loginReq) => {
    setLoading(true);
    setLoginError("");

    try {
      // 登录
      const msg = await userLogin({ ...values });

      // 完全依赖API返回的success字段判断成功或失败
      if (msg.success) {
        const defaultLoginSuccessMessage = intl.formatMessage({
          id: "pages.login.success",
          defaultMessage: "登录成功！",
        });
        message.success(defaultLoginSuccessMessage);

        // 处理不同的响应格式
        if (msg.data) {
          // 统一使用 OpenAPI 返回的字段名：token、expiresIn、refreshToken、refreshTokenExpiresIn
          saveTokens({
            accessToken: msg.data.token,
            refreshToken: msg.data.refreshToken || "",
            accessTokenExpiresIn: msg.data.expiresIn,
            refreshTokenExpiresIn: msg.data.refreshTokenExpiresIn,
          });
        }

        await fetchUserInfo();
        const urlParams = new URL(window.location.href).searchParams;
        window.location.href = urlParams.get("redirect") || "/";
        return;
      }

      // 登录失败，直接使用API返回的错误信息
      const errorMessage = msg.message || "登录失败，请重试";
      message.error(errorMessage);
      setLoginError(errorMessage);
    } catch (error: any) {
      const defaultLoginFailureMessage = intl.formatMessage({
        id: "pages.login.failure",
        defaultMessage: "登录失败，请重试！",
      });
      message.error(defaultLoginFailureMessage);
      setLoginError(defaultLoginFailureMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.brand}></div>
      <div className={styles.loginWrap}>
        <div className={styles.loginCard}>
          <h1 className={styles.loginTitle}>欢迎登录系统</h1>
          <p className={styles.loginSubTitle}> WELCOME!</p>
          <Form
            onFinish={async (values: any) => {
              const { username, password, remember } = values || {};
              await handleSubmit({ username, password, rememberMe: !!remember });
            }}
            className={styles.loginForm}
            name="basic"
          >
            {loginError && <LoginMessage content={loginError} />}
            <Form.Item
              name="username"
              rules={[
                {
                  required: true,
                  message: (
                    <FormattedMessage
                      id="pages.login.username.required"
                      defaultMessage="请输入用户名或邮箱!"
                    />
                  ),
                },
                {
                  validator: (_, value) => {
                    if (!value) {
                      return Promise.reject(new Error("请输入用户名或邮箱"));
                    }
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (value.length < 3 && !emailRegex.test(value)) {
                      return Promise.reject(new Error("用户名至少需要3个字符"));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input
                className={styles.loginFormItem}
                variant="filled"
                placeholder={intl.formatMessage({
                  id: "pages.login.username.placeholder",
                  defaultMessage: "用户名或邮箱",
                })}
                prefix={<UserOutlined className={styles.loginItemIcon} />}
              />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[
                {
                  required: true,
                  message: (
                    <FormattedMessage
                      id="pages.login.password.required"
                      defaultMessage="请输入密码！"
                    />
                  ),
                },
              ]}
            >
              <Input.Password
                className={styles.loginFormItem}
                variant="filled"
                placeholder={intl.formatMessage({
                  id: "pages.login.password.placeholder",
                  defaultMessage: "密码",
                })}
                prefix={<LockOutlined className={styles.loginItemIcon} />}
              />
            </Form.Item>
            <Form.Item name="remember" valuePropName="checked">
              <Checkbox className={styles.loginFormChexkBox}>
                <FormattedMessage id="pages.login.rememberMe" defaultMessage="自动登录" />
              </Checkbox>
            </Form.Item>
            <Form.Item>
              <Button className={styles.loginFormBtn} type="primary" htmlType="submit" block loading={loading}>
                立即登录
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Login;
