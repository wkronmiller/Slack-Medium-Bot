import redis from 'redis';
import slackClient from '@slack/client';
import hn from 'hackernews-api';
import htmlToText from 'html-to-text';
import {redisConfig, slackConfig} from './config';

const RtmClient = slackClient.RtmClient;
const RTM_EVENTS = slackClient.RTM_EVENTS;
const CLIENT_EVENTS = slackClient.CLIENT_EVENTS;

const rtm = new RtmClient(slackConfig.apiToken, {logLevel: 'info'});
console.log('Starting RTM client');
rtm.start();
console.log('Started RTM client');

const redisClient = redis.createClient({host: redisConfig.host, port: redisConfig.port});

function checkPost(postId){
    return new Promise((resolve, reject) => {
        redisClient.sadd("posts", postId, (err, result)=>{
            if(err){
                return reject(err);
            }
            const output = {exists: result, postId: postId};
            resolve(output);
        });
    });
}

function sendMessage(message) {
    console.log('Sending', message);
    rtm.sendMessage(message, slackConfig.postChannel, () => {});
}

function monitorNews() {
    const storyPromises = hn.getTopStories().map((postId) => {
        return checkPost(postId);
    });
    Promise.all(storyPromises)
    .then((results) => {
        const newPostIds = results.filter(({exists}) => exists == 1).map(({postId}) => postId);
        const maxIndex = Math.min(newPostIds.length - 1, 20);
        return newPostIds.slice(0, maxIndex);
    })
    .then((newPostIds) => {
      console.log('New posts', newPostIds.length);
        return newPostIds
        .map((postId, postIndex) => {
          console.log('Loading post', postId);
          setTimeout(() => {
              const post = hn.getItem(postId);
              console.log('Loading children for', postId);
              const kids = post.kids;
              const topComment = (() => {
                if(kids && kids.length > 0){
                  const comment = hn.getItem(kids[0]);
                  const commentText = htmlToText.fromString(comment.text, {
                    wordwrap: 80
                  });
                  return `${comment.by}: ${commentText}`;
                }
                return 'No comments';
              })();
              console.log('top comment', topComment);
              const postText = `*${post.title}*\n${post.url}\n\`\`\`${topComment}\`\`\``;
              sendMessage(postText);
          }, 1000 * postIndex);
        })
        .length;
    })
    .then((numNew) => {
        var timeoutMs = 20000;
        if(numNew < 3) {
            timeoutMs *= 10;
        }
        setTimeout(monitorNews, timeoutMs);
    });
}

rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
    console.log('Online');
    monitorNews();
});
