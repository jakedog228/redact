import { dispatch, subscribe, getState } from '../state.js';
import { formatTime } from '../utils.js';
import { FRAME_STEP } from '../constants.js';

let video;
let timeDisplay;

export function initPlayer() {
  video = document.getElementById('video');
  timeDisplay = document.getElementById('time-display');

  const btnPlay = document.getElementById('btn-play');
  const btnStepBack = document.getElementById('btn-step-back');
  const btnStepForward = document.getElementById('btn-step-forward');
  const btnStepBack5 = document.getElementById('btn-step-back-5');
  const btnStepForward5 = document.getElementById('btn-step-forward-5');

  btnPlay.addEventListener('click', togglePlay);
  btnStepBack.addEventListener('click', () => stepTime(-FRAME_STEP));
  btnStepForward.addEventListener('click', () => stepTime(FRAME_STEP));
  btnStepBack5.addEventListener('click', () => stepTime(-5));
  btnStepForward5.addEventListener('click', () => stepTime(5));

  video.addEventListener('timeupdate', () => {
    dispatch('SET_TIME', video.currentTime);
  });

  video.addEventListener('ended', () => {
    dispatch('SET_PLAYING', false);
  });

  subscribe('SET_TIME', (state) => {
    updateTimeDisplay(state.currentTime, state.videoDuration);
  });

  subscribe('SET_VIDEO', (state) => {
    updateTimeDisplay(0, state.videoDuration);
  });

  subscribe('SET_PLAYING', (state) => {
    btnPlay.textContent = state.playing ? '\u23F8' : '\u25B6';
  });
}

export function togglePlay() {
  const video = document.getElementById('video');
  if (video.paused) {
    video.play();
    dispatch('SET_PLAYING', true);
  } else {
    video.pause();
    dispatch('SET_PLAYING', false);
  }
}

export function stepTime(delta) {
  const video = document.getElementById('video');
  video.pause();
  dispatch('SET_PLAYING', false);
  video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
  dispatch('SET_TIME', video.currentTime);
}

export function seekTo(time) {
  const video = document.getElementById('video');
  video.currentTime = Math.max(0, Math.min(video.duration || 0, time));
  dispatch('SET_TIME', video.currentTime);
}

function updateTimeDisplay(current, duration) {
  if (timeDisplay) {
    timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  }
}
