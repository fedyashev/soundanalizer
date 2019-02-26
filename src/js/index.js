'use strict'

class AudioAnalizer {

    constructor() {
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        this.stopWithCallback = this.stopWithCallback.bind(this);
        this.play = this.play.bind(this);
        this.clear = this.clear.bind(this);
        Promise.resolve().then(async () => {

            console.log('Promise resolve begin');

            this.state = {
                mediaRecorder: null,
                audioChunks: [],
                audioBlob: null,
                audioUrl: null,
                buffer: [],
                getBufferPromise: null
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.state.mediaRecorder = new MediaRecorder(stream);

            this.state.mediaRecorder.addEventListener('dataavailable', e => {
                this.state.audioChunks.push(e.data);
            });

            // this.state.mediaRecorder.addEventListener('stop', e => {
            //     this.state.audioBlob = new Blob(this.state.audioChunks);
            //     this.state.audioUrl = URL.createObjectURL(this.state.audioBlob);
            // });
        });
    }

    start() {
        console.log('start');
        this.state.mediaRecorder.start();
    }

    stop() {
        console.log('stop');
        this.state.mediaRecorder.addEventListener('stop', e => {
            this.state.audioBlob = new Blob(this.state.audioChunks);
            this.state.audioUrl = URL.createObjectURL(this.state.audioBlob);

            //////////

            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createBufferSource();

            let fileReader = new FileReader();

            fileReader.onloadend = () => {
                audioCtx.decodeAudioData(fileReader.result,
                    buffer => {
                        source.buffer = buffer;
                        //this.state.buffer = buffer;
                        //this.state.getBufferPromise = Promise.resolve({buffer});

                        //console.log(buffer);

                        source.connect(audioCtx.destination);
                        source.start(0);
                    },
                    err => {
                        console.log(err);
                    }
                );
            }

            fileReader.readAsArrayBuffer(this.state.audioBlob);
        });

        this.state.mediaRecorder.stop();
    }

    stopWithCallback = (callback) => {
        console.log('stop async');

        this.state.mediaRecorder.addEventListener('stop', e => {
            this.state.audioBlob = new Blob(this.state.audioChunks);
            this.state.audioUrl = URL.createObjectURL(this.state.audioBlob);

            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            let fileReader = new FileReader();
            fileReader.onloadend = () => {
                audioCtx
                    .decodeAudioData(fileReader.result)
                    .then(buffer => {
                        this.state.buffer = buffer;
                        callback(buffer);
                    })
                    .catch(err => console.log(err));
            }
            fileReader.readAsArrayBuffer(this.state.audioBlob);
        });

        this.state.mediaRecorder.stop();
    }

    play() {
        console.log('play');
        const audio = new Audio(this.state.audioUrl);
        audio.play();
        //console.log(audio);
    }

    clear() {
        this.state.audioUrl = null;
        this.state.audioBlob = null;
        this.state.audioChunks = [];
        this.state.buffer = [];
    }

}

// CANVAS
const canvasWidth = window.innerWidth, canvasHeight = 120;
const newCanvas = createCanvas(canvasWidth, canvasHeight);
const context = newCanvas.getContext('2d');

window.onload = () => {

    document.getElementById('canvas-container').appendChild(newCanvas);
    //document.body.appendChild(newCanvas);

    let analizer = new AudioAnalizer();

    //alert("Let's go!");

    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnPlay = document.getElementById('btn-play');
    const btnClear = document.getElementById('btn-clear');

    btnStart.onclick = e => {
        e.preventDefault();
        console.log('btn-start');
        //console.log(analizer);
        analizer.start();
    }

    btnStop.onclick = e => {
        e.preventDefault();
        console.log('btn-stop');
        analizer.stopWithCallback(buffer => {
            //console.log(buffer);
            displayBuffer(buffer);
            const leftChannel = buffer.getChannelData(0);
            let max = leftChannel[0];
            let rms = 0;
            leftChannel.forEach(item => {
                max = item > max ? item : max
                rms += item * item;
            });
            rms /= 1.0 * buffer.length;
            rms = Math.sqrt(rms);
            document.getElementById('max-amplitude').innerText = Number(max).toFixed(2);
            document.getElementById('audio-buffer-rms').innerText = Number(rms).toFixed(4);
            document.getElementById('audio-buffer-length').innerText = buffer.length;
            document.getElementById('audio-buffer-duration').innerText = Number(buffer.duration).toFixed(2);
            document.getElementById('audio-buffer-channels').innerText = buffer.numberOfChannels;
            document.getElementById('audio-buffer-rate').innerText = buffer.sampleRate;
        });
    }

    btnPlay.onclick = e => {
        e.preventDefault();
        console.log('btn-play');
        analizer.play();
    }

    btnClear.onclick = e => {
        e.preventDefault();
        console.log('btn-clear');
        analizer.clear();
    }
};

function displayBuffer(buff /* is an AudioBuffer */) {
    const drawLines = 500;
    const leftChannel = buff.getChannelData(0); // Float32Array describing left channel     
    const lineOpacity = canvasWidth / leftChannel.length;
    context.save();
    context.fillStyle = '#666';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.strokeStyle = '#e2e200';
    context.globalCompositeOperation = 'lighter';
    context.translate(0, canvasHeight / 2);
    //context.globalAlpha = 0.6 ; // lineOpacity ;
    context.lineWidth = 1;
    const totallength = leftChannel.length;
    const eachBlock = Math.floor(totallength / drawLines);
    const lineGap = (canvasWidth / drawLines);

    context.beginPath();
    for (let i = 0; i <= drawLines; i++) {
        const audioBuffKey = Math.floor(eachBlock * i);
        const x = i * lineGap;
        const y = leftChannel[audioBuffKey] * canvasHeight / 2;
        context.moveTo(x, y);
        context.lineTo(x, (y * -1));
    }
    context.stroke();
    context.restore();
}

function createCanvas(w, h) {
    const newCanvas = document.createElement('canvas');
    newCanvas.width = w;
    newCanvas.height = h;
    return newCanvas;
};