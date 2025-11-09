import {
  AlipayCircleOutlined,
  LockOutlined,
  TaobaoCircleOutlined,
  UserOutlined,
  WeiboCircleOutlined,
} from "@ant-design/icons";
import {
  LoginForm,
  ProFormCheckbox,
  ProFormText,
} from "@ant-design/pro-components";
import {
  FormattedMessage,
  Helmet,
  SelectLang,
  useIntl,
  useModel,
} from "@umijs/max";
import { Alert, App, Tabs } from "antd";
import { createStyles } from "antd-style";
import React, { useState } from "react";
import { flushSync } from "react-dom";
import { Footer } from "@/components";
import { login as userLogin, getCurrentUser } from "@/services/yishan-admin/auth";
import { saveTokens } from "@/utils/token";
import Settings from "../../../../config/defaultSettings";

const useStyles = createStyles(({ token }) => {
  return {
    action: {
      marginLeft: "8px",
      color: "rgba(0, 0, 0, 0.2)",
      fontSize: "24px",
      verticalAlign: "middle",
      cursor: "pointer",
      transition: "color 0.3s",
      "&:hover": {
        color: token.colorPrimaryActive,
      },
    },
    lang: {
      width: 42,
      height: 42,
      lineHeight: "42px",
      position: "fixed",
      right: 16,
      borderRadius: token.borderRadius,
      ":hover": {
        backgroundColor: token.colorBgTextHover,
      },
    },
    container: {
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflow: "auto",
      backgroundImage:
        "url('https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/V-_oS6r-i7wAAAAAAAAAAAAAFl94AQBr')",
      backgroundSize: "100% 100%",
    },
  };
});

const ActionIcons = () => {
  const { styles } = useStyles();

  return (
    <>
      <AlipayCircleOutlined
        key="AlipayCircleOutlined"
        className={styles.action}
      />
      <TaobaoCircleOutlined
        key="TaobaoCircleOutlined"
        className={styles.action}
      />
      <WeiboCircleOutlined
        key="WeiboCircleOutlined"
        className={styles.action}
      />
    </>
  );
};

const Lang = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.lang} data-lang>
      {SelectLang && <SelectLang />}
    </div>
  );
};

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
  const { initialState, setInitialState } = useModel("@@initialState");
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
      console.error("获取用户信息失败:", error);
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
      console.error("登录错误:", error);
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
    <div className={styles.container}>
      <Helmet>
        <title>
          {intl.formatMessage({
            id: "menu.login",
            defaultMessage: "登录页",
          })}
          {Settings.title && ` - ${Settings.title}`}
        </title>
      </Helmet>
      <Lang />
      <div
        style={{
          flex: "1",
          padding: "32px 0",
        }}
      >
        <LoginForm<API.loginReq>
          contentStyle={{
            minWidth: 280,
            maxWidth: "75vw",
          }}
          logo={<img alt="logo" src="/logo.svg" />}
          title="Ant Design"
          subTitle={intl.formatMessage({
            id: "pages.layouts.userLayout.title",
          })}
          initialValues={{
            autoLogin: true,
          }}
          actions={[
            <FormattedMessage
              key="loginWith"
              id="pages.login.loginWith"
              defaultMessage="其他登录方式"
            />,
            <ActionIcons key="icons" />,
          ]}
          loading={loading}
          onFinish={async (values) => {
            await handleSubmit(values);
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h2>
              {intl.formatMessage({
                id: "pages.login.accountLogin.tab",
                defaultMessage: "账户密码登录",
              })}
            </h2>
          </div>

          {loginError && <LoginMessage content={loginError} />}
          <>
            <ProFormText
              name="username"
              fieldProps={{
                size: "large",
                prefix: <UserOutlined />,
              }}
              placeholder={intl.formatMessage({
                id: "pages.login.username.placeholder",
                defaultMessage: "用户名或邮箱",
              })}
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
                    // 简单的邮箱格式验证
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (value.length < 3 && !emailRegex.test(value)) {
                      return Promise.reject(new Error("用户名至少需要3个字符"));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            />
            <ProFormText.Password
              name="password"
              fieldProps={{
                size: "large",
                prefix: <LockOutlined />,
              }}
              placeholder={intl.formatMessage({
                id: "pages.login.password.placeholder",
                defaultMessage: "密码",
              })}
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
            />
          </>
          <div
            style={{
              marginBottom: 24,
            }}
          >
            <ProFormCheckbox noStyle name="autoLogin">
              <FormattedMessage
                id="pages.login.rememberMe"
                defaultMessage="自动登录"
              />
            </ProFormCheckbox>
            <a
              style={{
                float: "right",
              }}
            >
              <FormattedMessage
                id="pages.login.forgotPassword"
                defaultMessage="忘记密码"
              />
            </a>
          </div>
        </LoginForm>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
