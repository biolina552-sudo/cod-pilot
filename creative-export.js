import {Input,ALL_FORMATS,BlobSource,VideoSampleSink,Output,Mp4OutputFormat,WebMOutputFormat,BufferTarget,CanvasSource,AudioBufferSource,canEncodeVideo,canEncodeAudio} from 'mediabunny';

// Meta and TikTok expect MP4 (H.264 + AAC); fall back to WebM only where the browser cannot encode it.
async function pickFormat(canvas){
  const size={width:canvas.width,height:canvas.height,bitrate:6000000};
  if(await canEncodeVideo('avc',size)&&await canEncodeAudio('aac',{bitrate:128000}))return {format:new Mp4OutputFormat({fastStart:'in-memory'}),video:'avc',audio:'aac',bitrate:6000000,mime:'video/mp4',ext:'mp4'};
  return {format:new WebMOutputFormat(),video:'vp8',audio:'opus',bitrate:4000000,mime:'video/webm',ext:'webm'};
}

// Encode explicit frame timestamps, independent of playback, tab focus or wall-clock speed.
export async function exportMontage({clips,voice,canvas,onProgress,isCancelled}){
  if(typeof VideoEncoder==='undefined'||typeof AudioEncoder==='undefined')throw Error('التصدير الدقيق كيحتاج Chrome حديث.');
  const kind=await pickFormat(canvas);
  const target=new BufferTarget(),output=new Output({format:kind.format,target});
  const video=new CanvasSource(canvas,{codec:kind.video,bitrate:kind.bitrate});
  // Match the AAC layout probed in pickFormat so mono or 24 kHz narration still encodes.
  const audio=new AudioBufferSource({codec:kind.audio,bitrate:128000,transform:kind.audio==='aac'?{numberOfChannels:2,sampleRate:48000}:undefined});
  output.addVideoTrack(video);output.addAudioTrack(audio);
  const ctx=new AudioContext(),inputs=new Map();let finalized=false;
  try{
    const narration=await ctx.decodeAudioData(await voice.arrayBuffer());
    const total=clips.reduce((n,c)=>n+c.end-c.start,0);
    if(narration.duration>total+.1)throw Error('الصوت أطول من اللقطات. عاود التحضير.');
    await output.start();await audio.add(narration);audio.close();
    const g=canvas.getContext('2d'),step=1/25;let offset=0,frames=0;
    for(const [i,clip]of clips.entries()){
      if(isCancelled())throw Error('تلغى التصدير.');
      let media=inputs.get(clip.url);
      if(!media){
        const file=clip.file||await (await fetch(clip.url)).blob();
        const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});inputs.set(clip.url,{input});
        const track=await input.getPrimaryVideoTrack();
        if(!track||!await track.canDecode())throw Error('تعذر فك أحد الفيديوهات. جرّب MP4 متوافق.');
        media={input,sink:new VideoSampleSink(track),first:await input.getFirstTimestamp([track])};inputs.set(clip.url,media);
      }
      const duration=clip.end-clip.start,times=[];
      for(let t=0;t<duration-1e-7;t+=step)times.push(Math.max(media.first,clip.start+t));
      let n=0;
      for await(const frame of media.sink.samplesAtTimestamps(times)){
        try{
          if(isCancelled())throw Error('تلغى التصدير.');
          if(!frame)throw Error('تعذر استخراج إحدى الصور من الفيديو.');
          g.fillStyle='#111';g.fillRect(0,0,canvas.width,canvas.height);frame.drawWithFit(g,{fit:'contain'});
          const local=n*step;await video.add(offset+local,Math.min(step,duration-local),{keyFrame:frames%50===0});
          n++;frames++;if(frames%10===0)onProgress({clip:i+1,count:clips.length,seconds:offset+local,total,frames});
        }finally{frame?.close()}
      }
      if(n!==times.length)throw Error('التصدير ما كملش جميع صور اللقطة.');
      offset+=duration;
    }
    video.close();await output.finalize();finalized=true;
    return {blob:new Blob([target.buffer],{type:kind.mime}),ext:kind.ext,duration:total,frames,fps:25};
  }finally{
    for(const media of inputs.values())media.input.dispose();
    if(!finalized)try{await output.cancel()}catch{}
    await ctx.close();
  }
}
