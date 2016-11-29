export const redisConfig = {
    host: process.env.REDIS_HOST || 'redis'
};

console.log('Redis config', redisConfig);

export const mediumConfig = {
    token: process.env.MEDIUM_TOKEN,
    id: process.env.MEDIUM_ID,
    secret: process.env.MEDIUM_SECRET,
};

console.log('Medium config', mediumConfig);

export const slackConfig = {
    hookUrl: process.env.SLACK_URL,
    postChannel: process.env.SLACK_CHANNEL || 'medium',
};

console.log('Slack config', slackConfig);

function checkConfig(obj) {
    Object.keys(obj).forEach((key) => {
        if(!obj[key]){
            throw 'Invalid configuration';
        }
    });
}

[redisConfig, mediumConfig, slackConfig].forEach(checkConfig);
