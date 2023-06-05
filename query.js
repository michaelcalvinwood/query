const listenPort = 6255;
const hostname = 'query.pymnts.com'
const privateKeyPath = `/etc/letsencrypt/live/${hostname}/privkey.pem`;
const fullchainPath = `/etc/letsencrypt/live/${hostname}/fullchain.pem`;

const express = require('express');
const https = require('https');
const cors = require('cors');
const fs = require('fs');

const serp = require('./utils/serpWow');

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

    let result;
    switch (type) {
        case 'google_search_news':
            result = await serp.google('news', query, timePeriod, 50);
            if (result === false) return res.status(500).json('internal server error');
            return res.status(200).json(result);
            break;
        case "pymnts_search_news":
            result = await serp.google('news', query + ' site:pymnts.com', timePeriod, 50);
            if (result === false) return res.status(500).json('internal server error');
            return res.status(200).json(result);
            break;
        default:
            res.status(400).json('bad command');
    }
}


app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.post('/query', (req, res) => processQuery(req, res));

const httpsServer = https.createServer({
    key: fs.readFileSync(privateKeyPath),
    cert: fs.readFileSync(fullchainPath),
  }, app);
  

  httpsServer.listen(listenPort, '0.0.0.0', () => {
    console.log(`HTTPS Server running on port ${listenPort}`);
});


