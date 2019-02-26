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
        this.clear();
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
                        callback({ buffer, audioCtx });
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

class Visualizer {
    static createCanvasfromChannelData({ width = 960, height = 120, channelData = [], text = "" }) {

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        const drawLines = channelData.length;
        context.save();
        context.fillStyle = '#333';
        context.fillRect(0, 0, width, height);
        context.strokeStyle = '#f00';
        context.globalCompositeOperation = 'lighter';
        context.translate(0, height / 2);
        //context.globalAlpha = 0.6 ; // lineOpacity ;
        context.lineWidth = 1;
        const totalLength = channelData.length;
        const eachBlock = Math.floor(totalLength / drawLines);
        const lineGap = (width / drawLines);

        context.beginPath();
        for (let i = 0; i <= drawLines; i++) {
            const audioBuffKey = Math.floor(eachBlock * i);
            const x = i * lineGap;
            const y = channelData[audioBuffKey] * height / 2;
            context.moveTo(x, y);
            context.lineTo(x, (y * -1));
        }

        if (text) {
            context.fillStyle = "#ff0";
            context.font = "10px Arial";
            context.fillText(text, 10, height / 2 - 10);
        }

        context.stroke();
        context.restore();

        return canvas;
    }
}

window.onload = () => {

    let analizer = new AudioAnalizer();

    const canvasContainer = document.getElementById('canvas-container');
    const channelDataCanvas = Visualizer.createCanvasfromChannelData({
        width: window.innerWidth,
        height: 240,
    });
    canvasContainer.appendChild(channelDataCanvas);

    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');

    btnStart.hidden = false;
    btnStop.hidden = true;

    btnStart.onclick = e => {
        e.preventDefault();
        console.log('btn-start');
        btnStart.hidden = true;
        btnStop.hidden = false;
        analizer.start();
    }

    btnStop.onclick = e => {
        e.preventDefault();
        console.log('btn-stop');
        btnStart.hidden = false;
        btnStop.hidden = true;
        analizer.stopWithCallback(({ buffer, audioCtx }) => {

            const amplitudeToDecibel = value => {
                return 20 * Math.log10(value);
            }
            
            // Clear canvas container
            const canvasContainer = document.getElementById('canvas-container');
            while (canvasContainer.firstChild) {
                canvasContainer.removeChild(canvasContainer.firstChild);
            }

            for (let i = 0; i < buffer.numberOfChannels; i++) {
                const channelData = buffer.getChannelData(i);

                let max = channelData[0];
                let rms = 0;
                channelData.forEach(item => {
                    max = item > max ? item : max
                    rms += item * item;
                });
                rms /= 1.0 * buffer.length;
                rms = Math.sqrt(rms);

                let text = [
                    `CH ${i}`,
                    `AMP ${amplitudeToDecibel(Number(max)).toFixed(2)} dB`,
                    `RMS ${amplitudeToDecibel(Number(rms)).toFixed(2)} dB`,
                    `${buffer.duration} s`,
                    `${buffer.sampleRate} Hz`,
                ].join(',   ');

                const channelDataCanvas = Visualizer.createCanvasfromChannelData({
                    width: window.innerWidth,
                    height: 240,
                    channelData,
                    text
                });

                canvasContainer.appendChild(channelDataCanvas);
            }

        });
    }
};