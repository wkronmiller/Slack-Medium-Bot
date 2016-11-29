import medium from 'medium-sdk';
import redis from 'redis';
import flatMap from 'flatmap';
import fastFeed from 'fast-feed';
import querystring from 'querystring';
import request from 'request';
import htmlToText from 'html-to-text';
import {redisConfig, slackConfig, mediumConfig} from './config';

const REDIS_SET_NAME = 'medium-posts';

function checkPost(post){
    const postId = post.id
    return new Promise((resolve, reject) => {
        redisClient.sadd(REDIS_SET_NAME, postId, (err, result)=>{
            if(err){
                return reject(err);
            }
            const output = {exists: result == 0, id: postId, body: post.body};
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
    postData({text: message, username: 'medium-bot', channel: slackConfig.postChannel})
}

sendMessage('Medium bot online');

const redisClient = redis.createClient({host: redisConfig.host});
const mediumClient = new medium.MediumClient({
    clientId: mediumConfig.id,
    clientSecret: mediumConfig.secret
});
mediumClient.setAccessToken(mediumConfig.token);

function getUserId() {
    return new Promise((resolve, reject) => {
        mediumClient.getUser((err, user) => {
            if(err){
                return reject(err);
            }
            resolve(user.id);
        });
    });
}

function getPublications(userId){
    return new Promise((resolve, reject) => {
        mediumClient.getPublicationsForUser({userId: userId}, (err, publications) => {
            if(err){
                return reject(err);
            }
            return resolve(publications);
        })
    });
}

function getPublicationFeed(publication) {
    const {url} = publication;
    const header = 'https://medium.com/'
    return `${header}feed/${url.replace(header, '')}`;
}

function loadPublicationFeed(url) {
    return new Promise((resolve, reject) => {
        request(url, (error, response, body) => {
            if(!error && response.statusCode == 200) {
                return resolve(body);
            }
            return reject({error: error, response: response});
        });
    });
}

function loadPublicationFeeds(urls) {
    return Promise.all(urls.map(loadPublicationFeed));
}

function parseFeed(xml) {
    return fastFeed.parse(xml).items.map((item) => {
        Object.keys(item).map((key) => {
            item[key] = htmlToText.fromString(item[key]);
        });
        const {id, title, description} = item;
        const body = `*${title}*\nlink: ${id}`;
        return {id, body};
    });
}

(function monitorNews() {
    const docPromises = getUserId().then((userId) => {
        return getPublications(userId);
    })
    .then((publications) => publications.map(getPublicationFeed))
    .then((urls) => loadPublicationFeeds(urls))
    .then((xml_docs) => flatMap(xml_docs,parseFeed))
    .then((docs) => Promise.all(docs.map((doc)=> checkPost(doc))))
    .then((docs) => docs.filter((doc)=> doc.exists == false))
    .then((docs) => {
        docs.forEach((doc) => sendMessage(doc.body));
        console.log(`Sent ${docs.length} new posts`);
    })
    setTimeout(monitorNews, 1 * 60 * 1000);
})();
