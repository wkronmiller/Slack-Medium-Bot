export const redisConfig = {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};


export const slackConfig = {
    apiToken: process.env.SLACK_TOKEN,
    postChannel: process.env.SLACK_CHANNEL,
};
