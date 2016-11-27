import redis from 'redis';
import hn from 'hackernews-api';
import querystring from 'querystring';
import request from 'request';
import htmlToText from 'html-to-text';
import {redisConfig, slackConfig} from './config';


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

function postData(body) {
    const options = {
        url: slackConfig.hookUrl,
        method: 'POST',
        body: JSON.stringify(body),
    };
    console.log('opts', options);
    request(options, (err, response, body) => {
        if(err){
            throw err;
        }
        console.log(body);
    });
}

function sendMessage(message) {
    console.log('Sending', message);
    postData({text: message, username: 'hackernews-bot'})
}

sendMessage('Hackernews online');

const redisClient = redis.createClient({host: redisConfig.host});

(function monitorNews() {
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
})();
