const listenPort = 6255;
const hostname = 'query.pymnts.com'
const privateKeyPath = `/etc/letsencrypt/live/${hostname}/privkey.pem`;
const fullchainPath = `/etc/letsencrypt/live/${hostname}/fullchain.pem`;

require ('dotenv').config();
const express = require('express');
const https = require('https');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const cheerio = require('cheerio');


const fetchMetaData = require('meta-fetcher');
console.log(fetchMetaData);

const serp = require('./utils/serpWow');
const s3 = require('./utils/s3');
const ai = require('./utils/ai');
const urlUtil = require('./utils/url')
const proxycurl = require('./utils/proxycurl');

const {S3_ENDPOINT, S3_ENDPOINT_DOMAIN, S3_REGION, S3_KEY, S3_SECRET, S3_BUCKET} = process.env;
const s3Client = s3.client(S3_ENDPOINT, S3_ENDPOINT_DOMAIN, S3_REGION, S3_KEY, S3_SECRET, S3_BUCKET);

const app = express();
app.use(express.static('public'));
app.use(express.json({limit: '200mb'})); 
app.use(cors());

const googleNewsQuery = async (query, timePeriod, res) => {
    console.log('googleNewsQuery', query);
}

const processQuery = async (req, res) => {
    console.log(req.body);
    const {type, query, timePeriod, token } = req.body;

    if (!token) return res.status(400).json('bad request');

    if (!jwt.verify(token, process.env.JWT_SECRET)) return res.status(401).json('invalid');



    let result;
    switch (type) {
        case 'google_search_news':
            result = await serp.google('news', query, timePeriod, 50);
            if (result === false) return res.status(500).json('internal server error');
            return res.status(200).json(result);
            break;
        case 'google_search_web':
            result = await serp.google('web', query, timePeriod, 50);
            if (result === false) return res.status(500).json('internal server error');
            return res.status(200).json(result);
            break;
        case 'google_search_video':
            result = await serp.google('videos', query, timePeriod, 50);
            if (result === false) return res.status(500).json('internal server error');
            return res.status(200).json(result);
            break;
        case "pymnts_search_news":
            result = await serp.google('news', query + ' site:pymnts.com', timePeriod, 50);
            if (result === false) return res.status(500).json('internal server error');
            return res.status(200).json(result);
            break;
        case "pymnts_search_web":
            result = await serp.google('web', query + ' site:pymnts.com', timePeriod, 50);
            if (result === false) return res.status(500).json('internal server error');
            return res.status(200).json(result);
            break;
        case "pymnts_search_video":
            result = await serp.google('videos', query + ' site:pymnts.com', timePeriod, 50);
            if (result === false) return res.status(500).json('internal server error');
            return res.status(200).json(result);
            break;
        default:
            res.status(400).json('bad command');
    }
}

const getMeta = async (req, res) => {
   let response;
    console.log(req.body.url);
    console.log(fetchMetaData);

   try {
    response = await fetchMetaData(req.body.url);
   } catch (err) {
    console.error(err);
    return res.status(500).json('internal server error');
   }

   if (!response.metadata) return res.status(501).json('internal server error');

   if (!response.metadata.title) return res.status(502).json('internal server error');
   
   res.status(200).json(response.metadata.title);
}

const getPresignedUrl = async (req, res) => {
    const { key } = req.body;

    if (!key) return res.status(400).json('bad command');

    const url = await s3.presignedUploadUrl(s3Client, key);

    console.log('url', url);

    res.status(200).json(url);
}

const handleChatGPT = async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json('bad command');

    const response = await ai.chatGPT(prompt + "\n");

    if (!response) return res.status(500).json('internal server error');

    res.status(200).json(response);
}

const handleAIContinue = async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json('bad command');

    const response = await ai.chatGPT(prompt);

    if (!response) return res.status(500).json('internal server error');

    res.status(200).json(response);
}

const handleText = async (req, res) => {
    console.log('handleText');
    const { text } = req.body;
    if (!text) return res.status('400').json(false);

    let result;

    try {
        result = await s3.uploadTxtAsHTML(text, 'query-text', `text-${uuidv4()}.html`, s3Client);
        return res.status(200).json(result);
    } catch (err) {
        console.error(err);
        return res.status(500).json('internal server error');
    }

}

const getPhotoURLFromLinkedIn = async (url) => {


    let response = await urlUtil.getHTML(url, true);
    console.log('response',response);
    return '';


    try {
        let request = {
            url,
            method: 'get',
            headers: {
                "accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "accept-encoding" : "gzip, deflate, sdch, br",
                "accept-language" : "en-US,en;q=0.8,ms;q=0.6",
                "user-agent" : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36",
                "referer": ''
            }
        }
        response = await axios(request);
        html = response.data;
        const $ = cheerio.load(html);
        const photoEl = $('.pv-top-card-profile-picture__image');
        console.log('attribute', $(photoEl).attr('src'));
        return '';
    } catch(err) {
        console.error(err);
        return '';
    }
}

const handlePhoto = async (req, res) => {
    const { name, org } = req.body;

    if (!name || !org) return res.status(400).json('invalid');

    const q = `${name} ${org} site:linkedin.com`;

    const links = await serp.googleGeneral(q);
    //console.log(links);

    let photo = await proxycurl.getLinkedInPhoto(links[0].link);

    console.log('photo', photo);

    return res.status(200).json(photo);
}

const handleProfile = async (req, res) => {
    const { name, org } = req.body;

    if (!name || !org) return res.status(400).json('invalid');

    const q = `${name} ${org} site:linkedin.com`;

    const links = await serp.googleGeneral(q);
    //console.log(links);

    const profile = await proxycurl.getLinkedInProfile(links[0].link);



    return res.status(200).json('ok');
}

const handleAffiliation = async (req, res) => {
    const { id, content, name } = req.body;

    if (!id || !content || !name) return res.status(400).json('bad command');

    const prompt = `"""Below is an Article. From the article, determine what organization or entity that ${name} is affiliated with. Also determine the role of ${name}. If you cannot determine the affiliation the response must be the exact phrase "affiliation unknown".
    
    The return format must be in stringified JSON in the following format:
    {
        org: the name of the affiliated organization or entity goes here,
        role: the role of ${name} in the affiliated organization or entity goes here
    }
    
    Article:
    ${content}"""`

    const response = await ai.chatJSON(prompt);

    return res.status(200).json(response);
}

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.post('/query', (req, res) => processQuery(req, res));
app.post('/meta', (req, res) => getMeta(req, res));
app.post('/presignedUrl', (req, res) => getPresignedUrl(req, res));
app.post('/chatGPT', (req, res) => handleChatGPT(req, res));
app.post('/AIContinue', (req, res) => handleAIContinue(req, res));
app.post('/text', (req, res) => handleText(req, res));
app.post('/affiliation', (req, res) => handleAffiliation(req, res));
app.post('/photo', (req, res) => handlePhoto(req, res))
app.post('/profile', (req, res) => handleProfile(req, res));


const httpsServer = https.createServer({
    key: fs.readFileSync(privateKeyPath),
    cert: fs.readFileSync(fullchainPath),
  }, app);
  

  httpsServer.listen(listenPort, '0.0.0.0', () => {
    console.log(`HTTPS Server running on port ${listenPort}`);
});

//s3.download('https://content.pymnts.com/wp-content/uploads/2023/07/Brick-and-Mortar-founders-768x461.jpg', '/var/www/query.pymnts.com/profile-images/test.jpg');