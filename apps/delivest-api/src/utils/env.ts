export const getEnv = (): string => process.env.NODE_ENV || 'development';

export const isDev = (): boolean => getEnv() === 'development';

export const isProd = (): boolean => getEnv() === 'production';
