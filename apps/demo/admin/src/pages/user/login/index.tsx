import { LockOutlined, UserOutlined } from '@ant-design/icons';
import logoSrc from '@public/images/yishan-logo.webp';
import { FormattedMessage, useIntl, useModel } from '@umijs/max';
import { saveTokens } from '@yishan/core-admin/token';
import {
  authGetCurrentUser,
  authLogin as userLogin,
} from '@yishan/core-system-admin/services/auth';
import { Alert, App, Button, Checkbox, Form, Input } from 'antd';
import { Box, ChartNoAxesColumnIncreasing, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import styles from './index.less';

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
  const [loginError, setLoginError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { setInitialState } = useModel('@@initialState');

  const { message } = App.useApp();
  const intl = useIntl();

  const fetchUserInfo = async () => {
    try {
      // 检查是否已经通过登录接口获取了用户信息
      const cachedUserInfo = localStorage.getItem('currentUser');
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
          localStorage.removeItem('currentUser');
          return userData;
        } catch (error) {
          console.warn('解析缓存用户信息失败:', error);
          localStorage.removeItem('currentUser');
        }
      }

      // 标准流程：通过用户信息接口获取
      const response = await authGetCurrentUser();
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
    } catch (_error) {
      return null;
    }
  };

  const resolveRedirectAfterLogin = () => {
    const redirect = new URL(window.location.href).searchParams.get('redirect');
    if (!redirect) return '/';
    try {
      const target = new URL(redirect, window.location.origin);
      let normalizedPath = target.pathname;
      const basePrefix =
        __APP_BASE__ === '/' ? '' : __APP_BASE__.replace(/\/+$/, '');
      if (basePrefix && normalizedPath.startsWith(basePrefix)) {
        normalizedPath = normalizedPath.slice(basePrefix.length) || '/';
      }
      if (normalizedPath === '/user/login' || normalizedPath === '/') {
        return '/';
      }
      return `${normalizedPath}${target.search}${target.hash}`;
    } catch {
      return '/';
    }
  };

  const hardRedirectAfterLogin = (targetPath: string) => {
    const basePrefix =
      __APP_BASE__ === '/' ? '' : __APP_BASE__.replace(/\/+$/, '');
    window.location.href = `${basePrefix}${targetPath}`;
  };

  const handleSubmit = async (values: SystemAPI.loginReq) => {
    setLoading(true);
    setLoginError('');

    try {
      // 登录
      const msg = await userLogin({ ...values }, { skipErrorHandler: true });

      // 完全依赖API返回的success字段判断成功或失败
      if (msg.success) {
        const defaultLoginSuccessMessage = intl.formatMessage({
          id: 'pages.login.success',
          defaultMessage: '登录成功！',
        });
        message.success(msg.message || defaultLoginSuccessMessage);

        // 处理不同的响应格式
        if (msg.data) {
          // 统一使用 OpenAPI 返回的字段名：token、expiresIn、refreshToken、refreshTokenExpiresIn
          saveTokens({
            accessToken: msg.data.token,
            refreshToken: msg.data.refreshToken || '',
            accessTokenExpiresIn: msg.data.expiresIn,
            refreshTokenExpiresIn: msg.data.refreshTokenExpiresIn,
          });
        }

        await fetchUserInfo();
        hardRedirectAfterLogin(resolveRedirectAfterLogin());
        return;
      }

      // 登录失败：仅在表单内展示红色 Alert，不再额外弹全局 toast 重复打扰用户。
      const errorMessage = msg.message || '登录失败，请稍后再试';
      setLoginError(errorMessage);
    } catch (error: any) {
      // 优先取后端在 4xx/5xx 上带回的信封 message（用户名或密码错误 / 账号被禁用等）。
      // 顺序：response.data.message → error.message → 默认兜底。
      // 注意：response.data 可能是 HTML（网关错误页）或字符串，避免直接当对象读。
      // 全局 errorHandler 已经放过 message.error 了，这里只在表单内再展示一次，
      // 避免登录页同时弹 toast + Alert 重复打扰。
      const data = error?.response?.data;
      const envelopeMessage =
        data &&
        typeof data === 'object' &&
        typeof data.message === 'string' &&
        data.message.trim()
          ? data.message.trim()
          : null;
      const errorMessage =
        envelopeMessage ||
        (typeof error?.message === 'string' && error.message.trim()) ||
        intl.formatMessage({
          id: 'pages.login.failure',
          defaultMessage: '登录失败，请稍后再试',
        });
      setLoginError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <section className={styles.brand} aria-label="移山品牌">
        <div className={styles.brandIdentity}>
          <img src={logoSrc} alt="" className={styles.brandLogo} />
          <span className={styles.brandName}>移山</span>
        </div>
        <div className={styles.brandCopy}>
          <h2>
            <span>移山</span> · 让组织
            <br />
            成就更大的可能
          </h2>
          <p>
            连接人、数据与业务，
            <br />
            让每一个团队都能走得更远。
          </p>
        </div>
        <div className={styles.capabilities}>
          <div>
            <Box aria-hidden />
            <div>
              <strong>高效协同</strong>
              <small>打通信息与流程</small>
            </div>
          </div>
          <div>
            <ChartNoAxesColumnIncreasing aria-hidden />
            <div>
              <strong>数据驱动</strong>
              <small>让决策更智能</small>
            </div>
          </div>
          <div>
            <ShieldCheck aria-hidden />
            <div>
              <strong>安全可靠</strong>
              <small>企业级数据安全保障</small>
            </div>
          </div>
        </div>
      </section>
      <div className={styles.loginWrap}>
        <div className={styles.loginCard}>
          <div className={styles.mobileBrand}>
            <div className={styles.brandIdentity}>
              <img src={logoSrc} alt="" className={styles.brandLogo} />
              <span className={styles.brandName}>移山</span>
            </div>
          </div>
          <h1 className={styles.loginTitle}>欢迎使用移山</h1>
          <p className={styles.loginSubTitle}>登录账号，继续访问工作台</p>
          <Form
            layout="vertical"
            requiredMark={false}
            onFinish={async (values: {
              username: string;
              password: string;
              remember?: boolean;
            }) => {
              const { username, password, remember } = values || {};
              await handleSubmit({
                username,
                password,
                rememberMe: !!remember,
              });
            }}
            className={styles.loginForm}
            name="basic"
          >
            {loginError && <LoginMessage content={loginError} />}
            <Form.Item
              name="username"
              label={<span className={styles.formLabel}>账号</span>}
              rules={[
                {
                  required: true,
                  message: intl.formatMessage({
                    id: 'pages.login.username.required',
                    defaultMessage: '请输入用户名',
                  }),
                },
                {
                  validator: (_, value) => {
                    if (!value) {
                      return Promise.reject(new Error('请输入用户名'));
                    }
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (value.length < 3 && !emailRegex.test(value)) {
                      return Promise.reject(new Error('用户名至少需要3个字符'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input
                autoComplete="username"
                className={styles.loginFormItem}
                classNames={{ input: styles.input }}
                styles={{ input: { backgroundColor: 'transparent' } }}
                variant="outlined"
                placeholder={intl.formatMessage({
                  id: 'pages.login.username.placeholder',
                  defaultMessage: '请输入账号',
                })}
                prefix={<UserOutlined className={styles.loginItemIcon} />}
              />
            </Form.Item>
            <Form.Item
              name="password"
              label={<span className={styles.formLabel}>密码</span>}
              rules={[
                {
                  required: true,
                  message: intl.formatMessage({
                    id: 'pages.login.password.required',
                    defaultMessage: '请输入密码！',
                  }),
                },
              ]}
            >
              <Input.Password
                autoComplete="current-password"
                className={styles.loginFormItem}
                classNames={{ input: styles.input }}
                styles={{ input: { backgroundColor: 'transparent' } }}
                variant="outlined"
                placeholder={intl.formatMessage({
                  id: 'pages.login.password.placeholder',
                  defaultMessage: '请输入密码',
                })}
                prefix={<LockOutlined className={styles.loginItemIcon} />}
              />
            </Form.Item>
            <Form.Item
              name="remember"
              valuePropName="checked"
              className={styles.rememberItem}
            >
              <Checkbox style={{ color: '#5e6e91' }}>
                <FormattedMessage
                  id="pages.login.rememberMe"
                  defaultMessage="自动登录"
                />
              </Checkbox>
            </Form.Item>
            <Form.Item className={styles.submitItem}>
              <Button
                className={styles.loginFormBtn}
                type="primary"
                htmlType="submit"
                block
                loading={loading}
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Login;
