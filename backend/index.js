'use strict';

const Hapi = require('@hapi/hapi');
const fs = require('fs')
const axios = require('axios')
const speech = require('@google-cloud/speech');
const ffmpeg = require('fluent-ffmpeg');  

const client = new speech.SpeechClient();

const init = async () => {

    const server = Hapi.server({
        port: 3005,
        host: '10.10.1.149'
    });

    server.route({
        method: 'POST',
        path: '/speech',
        config: {
            handler: async (request, h) => {
                const data = request.payload;
                console.log(request)
                if (data.file) {
                    const name = data.file.hapi.filename;
                    const path = __dirname + "/uploads/" + name;
                    const encodedPath = __dirname + "/uploads/encoded_" + name;
                    const file = fs.createWriteStream(path);
    
                    file.on('error', (err) => console.error(err));
    
                    data.file.pipe(file);
    
                    return new Promise(resolve => {
                        data.file.on('end', async (err) => { 
                            const ret = {
                                filename: data.name,
                                headers: data.file.hapi.headers
                            }

                            ffmpeg()
                                .input(path)
                                .outputOptions([
                                    '-f s16le',
                                    '-acodec pcm_s16le',
                                    '-vn',
                                    '-ac 1',
                                    '-ar 41k',
                                    '-map_metadata -1'
                                ])
                                .save(encodedPath)
                                .on('end', async () => {
                                    const savedFile = fs.readFileSync(encodedPath)

                                    const audioBytes = savedFile.toString('base64');
                                    const audio = {
                                        content: audioBytes,
                                    }
                                    const sttConfig = {
                                        enableAutomaticPunctuation: false,
                                        encoding: "LINEAR16",
                                        sampleRateHertz: 41000,
                                        languageCode: "pl-PL",
                                        model: "default"
                                    }
            
                                    const request = {
                                        audio: audio,
                                        config: sttConfig,
                                    }
            
                                    const [response] = await client.recognize(request);
                                    const transcription = response.results
                                        .map(result => result.alternatives[0].transcript)
                                        .join('\n');

                                    fs.unlinkSync(path)
                                    fs.unlinkSync(encodedPath)
                                    resolve(JSON.stringify({...ret, transcript: transcription}))

                                })
                        })
                    })
                }
            },
            payload: {
                output: 'stream',
                parse: true,
            }
        }
    })

    server.route({
        method: 'POST',
        path: '/results',
        config: {
            handler: async (request, h) => {
                const data = request.payload;
                const path = __dirname + "/uploads/wyniki-" + new Date() + ".json";

                console.log(data)

                let stream = fs.createWriteStream(path);
                stream.once('open', function(fd) {
                    stream.write(data);
                    stream.end();
                });

                stream.on('error', (err) => console.error(err));


                return new Promise(resolve => {
                    resolve(JSON.stringify({resp: "zapisano"}));
                });
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/results',
        config: {
            handler: async (request, h) => {
                const data = request.payload;
                const path = __dirname + "/uploads";
                let results = []

                fs.readdir(path, function (err, files) {
                    if (err) {
                        return console.log('Unable to scan directory: ' + err);
                    }
                    files.forEach(function (file) {
                        console.log(file);
                        if (file.startsWith("wyniki")) {
                            let wynik;
                            try {
                                let rawdata = fs.readFileSync(path +"/"+file);
                                wynik = JSON.parse(rawdata);
                                console.log("wynik: ");
                                console.log(wynik);
                            } catch (error) {
                                console.log(error);
                            }

                            results.push(wynik);

                        }
                    });
                });

                return new Promise(resolve => {
                    resolve(JSON.stringify({results: results}));
                });
            }
        }
    });



    await server.start();
    console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
});

init();