import "express-session";
import "multer";
import fs from 'fs';

import { User } from "../database/User.js";
import { Video } from "../database/Video.js";
import { VideoLog } from "../database/VideoLog.js";

export const getUpload = async(req, res) => {
    const title = "Upload";

    // 로그인이 되지 않았을 때 업로드 페이지 접근 불가능
    if(req.session.userId === undefined) {
        return res.redirect("/users/login");
    }

    res.render("video/upload", {title})
}

export const postUpload = async (req, res) => {
    const { title, description, hashtag } = req.body;
    const { thumbnail, video } = req.files;
    let viewThumbnail = "";
    let videoFile = "";

    // 파일 없이 업로드를 할 경우
    if(thumbnail === undefined || video === undefined) {
        const error = "There is no file";
        return res.render("video/upload", {error});
    }

    // 확장자가 일치하지 않은 경우
    if(thumbnail[0].originalname.match(/\.(jpg|jpeg|png)$/) === null) {
        const error = "Only the image is possible.(jpg, jpeg, png)";
        return res.render("video/upload", {error});
    }

    if(video[0].originalname.match(/\.(mp4)$/) === null) {
        const error = "Only the video is possible.(mp4)";
        return res.render("video/upload", {error});
    }

    // thumbnail 을 등록하지 않고 업로드를 할 경우 에러 메시지 출력
    if(req.files['thumbnail']) {
        viewThumbnail = req.files['thumbnail'][0].filename;
    } else {
        const error = 'You recommend that you register your picture';
        return res.render('video/upload', {error})
    }

    // videoFile 을 등록하지 않고 업로드를 할 경우 에러 메시지 출력
    if(req.files['video']) {
        videoFile = req.files['video'][0].filename;
    } else {
        const error = 'You recommed that you register your video';
        return res.render('video/upload', {error});
    }

    const date = new Date();
    const uploadDate = date.getFullYear() + '. ' + (date.getMonth() + 1) + '. ' + date.getDate();
    const id = req.session.userId;

    await Video.create({
        thumbnail: viewThumbnail,
        videoFile,
        title,
        description,
        hashtag: hashtag.startsWith(' ', 1) ? "" : hashtag,
        uploadDate,
        userId: id,
    });
    res.redirect('/');
}

export const getWatch = async (req, res) => {
    const { id } = req.params;
    let video = await Video.findById(id);
    const title = video.title;
    let views = video.views + 1;

    const viewDate = new Date();

    // 비디오 링크를 클릭하면 시청한 비디오 저장
    const userId = req.session.userId;
    if(userId) {
        const user = await User.findById(userId);
        const { email } = req.session;
        const videoLog = await VideoLog.findOne({email});
        let videos = videoLog.videos;
        let videoIn = "";

        video = await Video.findByIdAndUpdate(id, {views, viewDate}, {returnDocument: 'after'});

        // 좋아요 버튼 또는 싫어요 버튼이 클릭되어 있는 경우
        let button = "";
        if(user.like.includes(id)) {
            button = "like"
        } else if(user.hate.includes(id)) {
            button = "hate"
        } else {
            button = ""
        }

        // videoLog 의 videos 가 현재 비디오 값과 일치하는 게 있다면 마지막으로 시청한 시간 값을 가져옴
        for(let i = 0; i < videos.length; i++) {
            if(videos[i]._id.toString() === id) {
                videoIn = videos[i].viewDate;
            } else {
                videos.push(video);
                videos.reverse();
            }
        }

        return res.render('video/watch', {video, title, userId, button, videoIn});
    }

    video = await Video.findByIdAndUpdate(id, {views, viewDate}, {returnDocument: 'after'});

    res.render('video/watch', {video, title});
}

export const postWatch = async (req, res) => {
    const { text, delCommentId } = req.body;
    const { id } = req.params;
    const userId = req.session.userId;
    const date = new Date();

    // 좋아요 또는 싫어요 버튼을 누르면 비디오 id 값 받음(ajax)
    const videoId = req.body.id;

    const user = await User.findById(userId);

    const video = await Video.findById(id);
    let comments = video.comments;
    let userLike = video.userLike;
    
    const { email } = req.session;
    const videoLog = await VideoLog.findOne({email});
    
    // 현재 시청한 시각과 과거 시청한 시간이 하루 이상 차이나면 watch recode 에 새로 추가하고, 아니면 맨 위로 정렬.
    // 로그인 상태일 경우에만
    if(userId) {
        let videos = videoLog.videos;
        if(req.body.changeRecode) {
            for(let i = 0; i < videos.length; i++) {
                if(videos[i]._id.toString() === id){
                    videos.splice(i, 1);
                }
            }

            videos.unshift(video);

            return await VideoLog.findOneAndUpdate({email}, {videos});
        } 
        
        if(req.body.changeRecode === false) {
            videos.unshift(video);

            return await VideoLog.findOneAndUpdate({email}, {videos});
        }

        // 좋아요 버튼을 눌렀을 경우
        if(req.body.like === 'true') {
            let like = user.like;
            like.unshift(videoId);

            let hate = user.hate;
            if(hate.includes(videoId)) {
                hate.splice(hate.indexOf(videoId), 1);
            }

            await User.findByIdAndUpdate(userId, {
                like,
                hate,
            })

            userLike.push(userId);
            await Video.findByIdAndUpdate(id, {userLike});

            return res.json(userLike);
        } 
        
        // 좋아요 버튼을 한 번 더 눌렀을 경우
        if (req.body.like === 'false') {
            let like = user.like;
            if(like.includes(videoId)) {
                like.splice(like.indexOf(videoId), 1);
            }

            await User.findByIdAndUpdate(userId, {
                like,
            })

            if(userLike.includes(userId)) {
                userLike.splice(userLike.indexOf(userId), 1);
            }

            await Video.findByIdAndUpdate(id, {userLike});

            return res.json(userLike);
        }

        
        // 싫어요 버튼을 눌렀을 경우
        if(req.body.hate === 'true') {
            let hate = user.hate;
            hate.push(videoId);

            let like = user.like;
            if(like.includes(videoId)) {
                like.splice(like.indexOf(videoId), 1);
            }

            if(userLike.includes(userId)) {
                userLike.splice(userLike.indexOf(userId), 1);
            }

            await Video.findByIdAndUpdate(id, {userLike});

            await User.findByIdAndUpdate(userId, {
                like,
                hate,
            })

            return res.json(userLike);
        } 
        
        // 싫어요 버튼을 한 번 더 눌렀을 경우
        if (req.body.hate === 'false') {
            let hate = user.hate;
            if(hate.includes(videoId)) {
                hate.splice(hate.indexOf(videoId), 1);
            }

            return await User.findByIdAndUpdate(userId, {
                hate,
            })
        }
    }

    // 댓글 part
    // 로그인을 했을 시에만 댓글 작성
    if(userId && text) {
        const name = user.name;
        const data = {
            userId,
            name,
            text,
            date,
        }

        comments.unshift(data);

        const updateVideo = await Video.findByIdAndUpdate(id, {
            comments
        }, {returnDocument: 'after'});

        // 댓글을 달았을 때 부여된 아이디 값 추출
        const commentId = updateVideo.comments[0]._id

        const responseData = {
            userId,
            name,
            text,
            date,
            commentId,
        }

        return res.json(responseData);
    }

    // 댓글 삭제 버튼을 눌렀을 때 comment ID 값이 있는 경우
    if(delCommentId) {
        for(let i = 0; i < comments.length; i++) {
            if(comments[i]._id.toString() === delCommentId) {
                comments.splice(i, 1);
            }
        }

        await Video.findByIdAndUpdate(id, {
            comments
        })

        return res.json(comments);
    }
}

export const getMyVideo = async (req, res) => {
    const title = "My Videos"

    // 로그인이 되지 않았을 때 업로드 페이지 접근 불가능
    if(req.session.userId === undefined) {
        return res.redirect("/users/login");
    }

    const { userId } = req.session;
    const videos = await Video.find({userId});

    res.render('video/myVideo', {title, videos});
}

export const postMyVideo = async (req, res) => {
    const { videoId } = req.body;

    const video = await Video.findById(videoId);
    const thumbnail = video.thumbnail;
    const videoFile = video.videoFile;

    // 썸네일과 비디오 삭제
    fs.unlink(`upload/thumbnail/${thumbnail}`, (err) => {
        if (err !== null) {
            console.log(err);
        }
    });
    fs.unlink(`upload/video/${videoFile}`, (err) => {
        if (err !== null) {
            console.log(err);
        }
    });

    // Video DB 에서의 비디오 정보 삭제
    await Video.findByIdAndRemove(videoId);

    // VideoLog DB 에서의 비디오 정보 delete 수정
    const email = req.session.email;
    const videoLog = await VideoLog.findOne({email});
    let videos = videoLog.videos;

    // watchRecode.pug 에서 delete 정보를 사용
    for(let i = 0; i < videos.length; i++) {
        if(videos[i]._id.toString() === videoId) {
            videos[i].delete = true;
        }
    }

    await VideoLog.findOneAndUpdate({email}, {videos});

    return res.json(videoId);
}

export const getWatchRecode = async (req, res) => {
    const title = "Watch Recode";

    // 로그인이 되지 않았을 때 업로드 페이지 접근 불가능
    if(req.session.userId === undefined) {
        return res.redirect("/users/login");
    }

    const userId = req.session.userId;
    if(userId) {
        const user = await User.findById(userId);
        const email = user.email;

        const videoLog = await VideoLog.findOne({email});
        const videos = videoLog.videos;

        return res.render('video/watchRecode', {title, videos});
    }

    res.redirect('/');
}

export const postWatchRecode = async (req, res) => {
    const { videoId } = req.body;
    const { email } = req.session;

    const videoLog = await VideoLog.findOne({email});
    let videos = videoLog.videos;
    
    // videoLog 에 있는 video ID 와 삭제하려는 video ID 가 같으면 삭제
    for(let i = 0; i < videos.length; i++) {
        if("" + videos[i]._id === videoId) {
            videos.splice(i, 1);
        }
    }

    await VideoLog.findOneAndUpdate({email}, {videos});
    
    return res.json(videoId);
}

export const getLikePlaylist = async (req, res) => {
    const userId = req.session.userId;

    const user = await User.findById(userId);
    const playlist = [];

    // 로그인을 하지 않고 링크로 접근하는 경우
    if(!req.session.userId) {
        return res.redirect('/users/login');
    }

    // user.like 에 저장된 video ID 값을 찾아 playlist 에 저장
    for(let i = 0; i < user.like.length; i++) {
        playlist.push(await Video.findById(user.like[i]));
    }

    res.render('video/likePlaylist', {playlist});
}

export const postLikePlaylist = async (req, res) => {
    const videoId = req.body.videoId;

    // 좋아요 누른 video ID 가 있으면(삭제를 누른 경우)
    if(videoId) {
        const userId = req.session.userId;
        const user = await User.findById(userId);
        const videoList = user.like;

        const video = await Video.findById(videoId);
        const videoLike = video.userLike;

        if(videoList.includes(videoId)) {
            videoList.splice(videoList.indexOf(videoId), 1);
        }

        if(videoLike.includes(userId)) {
            videoLike.splice(videoLike.indexOf(userId), 1);
        }

        const updateUser = await User.findByIdAndUpdate(userId, {
            like: videoList,
        }, {returnDocument: 'after'})

        await Video.findByIdAndUpdate(videoId, {
            userLike: videoLike,
        })

        return res.json(updateUser.like);
    }
    return res.redirect('/')
}

export const getEditVideo = async (req, res) => {
    const { id } = req.params;
    const video = await Video.findById(id);

    // 로그인을 하지 않고 링크로 접근하는 경우
    if(!req.session.userId) {
        return res.redirect('/users/login');
    }

    return res.render('video/editVideo', {video, id})
}

export const postEditVideo = async (req, res) => {
    const { id } = req.params;
    const { title, description, hashtag } = req.body;
    
    const video = await Video.findById(id);
    if(req.file === undefined) {
        const error = 'There is no file';
        return res.render('video/editVideo', {error, video, id})
    }

    if(req.file.originalname.match(/\.(jpg|jpeg|png)$/) === null) {
        const error = "Only the image is possible.(jpg, jpeg, png)";
        return res.render('video/editVideo', {error, video, id})
    }

    fs.unlink(`upload/thumbnail/${video.thumbnail}`, (err) => {
        if(err !== null) {
            console.log(err);
        }
    })

    const thumbnail = req.file.filename;

    await Video.findByIdAndUpdate(id, {
        title,
        description,
        hashtag,
        thumbnail,
    })

    return res.redirect(`/videos/${id}/edit`);
}