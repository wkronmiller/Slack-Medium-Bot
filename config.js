export const redisConfig = {
    host: process.env.REDIS_HOST || 'redis'
};

console.log('Redis config', redisConfig);

export const slackConfig = {
    hookUrl: process.env.SLACK_URL
};

console.log('Slack config', slackConfig);
