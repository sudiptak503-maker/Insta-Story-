import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, getDoc, where, getDocs, limit, startAfter, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// Cloudinary Configuration
// ==========================================
window.CLOUDINARY_CONFIG = {
    postStory: {
        cloudName: 'jpkp0bd0',
        uploadPreset: 'Insta Story'
    },
    reel: {
        cloudName: 'dzt2shn4m',
        uploadPreset: 'Instaastory'
    }
};

// ==========================================
// Firebase Init
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyD5ZsNOaprK3pJafOmRZYbC-s-HLAK-Msg",
    authDomain: "insta-story-da3ac.firebaseapp.com",
    projectId: "insta-story-da3ac",
    storageBucket: "insta-story-da3ac.firebasestorage.app",
    messagingSenderId: "65354990535",
    appId: "1:65354990535:web:f8ae3a7a51ff929f108fe2"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') console.warn('Multiple tabs open');
    else if (err.code == 'unimplemented') console.warn('Persistence not supported');
});

const zuuPayConfig = {
    apiKey: "AIzaSyBbBKnhSe4Oy43DSQAYJa5wiuR-rktw3Cc",
    authDomain: "zuu-pay.firebaseapp.com",
    projectId: "zuu-pay",
    storageBucket: "zuu-pay.firebasestorage.app",
    messagingSenderId: "119466521939",
    appId: "1:119466521939:web:b47248cc997b2dd602dda6"
};
const zuuApp = initializeApp(zuuPayConfig, "ZuuPayApp");
const zuuDb = getFirestore(zuuApp);

// ==========================================
// Global State
// ==========================================
let currentUser = null, allUsers = [], allPosts = [], groupedStories = {}, myActiveStories = [];
let viewedStories = {};
let activeStoryUser = null;
let unreadNotifCount = 0;
let lastVisiblePost = null;
let isLoadingPosts = false;

window.viewedPostsSession = new Set();

let selMusicUrl = null;
let selMusicName = "";
let selAudioFile = null;
let previewAudioObj = null;

window.upType = '';
let selFile = null;

let currentProfileViewUid = null;
let actComId = null, actComOwn = null;
let actChatU = null, chatUnsub = null;
let actStoryU = null, actStoryIdx = 0, stTime, isMySt = false, actStArr = [];
let postToShare = null, shareMediaType = 'post';
let touchstartX = 0, touchendX = 0;

const cloudMusicLibrary = [
    { id: 'm1', name: 'Trending Beat (Lo-Fi)', artist: 'Insta Music', url: 'https://res.cloudinary.com/demo/video/upload/v1688636402/docs/audio_sample.mp3' },
    { id: 'm2', name: 'Romantic BGM', artist: 'Creator Hub', url: 'https://res.cloudinary.com/demo/video/upload/dog.mp3' },
    { id: 'm3', name: 'Comedy Laugh Effect', artist: 'Star Tv2', url: 'https://res.cloudinary.com/demo/video/upload/v1688636402/docs/audio_sample.mp3' },
    { id: 'm4', name: 'Cinematic Intense', artist: 'Background Audio', url: 'https://res.cloudinary.com/demo/video/upload/dog.mp3' }
];

// ==========================================
// Utility Functions
// ==========================================
window.showToast = (msg) => {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
};

window.openProConfirm = (title, onConfirm) => {
    document.getElementById('pro-title').innerText = title;
    document.getElementById('pro-confirm-modal').classList.add('show');
    document.getElementById('pro-yes').onclick = () => {
        document.getElementById('pro-confirm-modal').classList.remove('show');
        onConfirm();
    };
};

function formatPostDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options).toUpperCase();
}

// ==========================================
// Navigation
// ==========================================
window.navigateTo = (page) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    if (page !== 'home') {
        document.querySelectorAll('audio, video').forEach(media => media.pause());
        document.querySelectorAll('.audio-toggle-btn').forEach(btn => {
            btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            btn.classList.remove('playing');
        });
    }

    document.getElementById(page + '-page').classList.add('active');

    document.getElementById('bottom-nav-bar').style.display =
        (page === 'chat' || page === 'messages' || page === 'creator-hub' || page === 'admin-panel') ? 'none' : 'flex';

    if (document.querySelector(`.nav-item[data-page="${page}"]`))
        document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

    if (page === 'profile') loadProfile();
    if (page === 'messages') renderMessagesList();
    if (page === 'creator-hub') window.loadCreatorHub();
    if (page === 'admin-panel') {
        window.loadAdminPanel();
        window.showAdminSection('users');
    }
    if (page === 'explore') switchLeaderboard('normal');
    if (page === 'reels' && typeof window.loadReels === 'function') window.loadReels();

    if (page === 'notifications') {
        localStorage.setItem('lastNotifCheck', Date.now());
        document.getElementById('notif-badge-indicator').style.display = 'none';
        unreadNotifCount = 0;
    }

    if (page === 'home' && typeof window.resumeAllAudio === 'function') {
        setTimeout(() => window.resumeAllAudio(), 150);
    }
};

// Pause all media when tab hidden
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        document.querySelectorAll('audio, video').forEach(media => media.pause());
        document.querySelectorAll('.audio-toggle-btn').forEach(btn => {
            btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            btn.classList.remove('playing');
        });
    }
});

// ==========================================
// Auth
// ==========================================
let isLogin = true;
document.getElementById('toggle-auth').addEventListener('click', () => {
    isLogin = !isLogin;
    document.getElementById('auth-btn').textContent = isLogin ? 'Log In' : 'Sign Up';
    document.getElementById('name-group').style.display = isLogin ? 'none' : 'block';
    document.querySelector('.toggle-auth').innerHTML = isLogin
        ? 'Don\'t have an account? <span>Sign Up</span>'
        : 'Already have an account? <span>Log In</span>';
});

document.getElementById('auth-btn').addEventListener('click', async () => {
    const e = document.getElementById('auth-email').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    const n = document.getElementById('auth-name').value.trim();
    if (!e || !p) return showToast('Enter email and password');
    document.getElementById('global-loader').classList.remove('hidden');
    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, e, p);
        } else {
            const c = await createUserWithEmailAndPassword(auth, e, p);
            await setDoc(doc(db, "users", c.user.uid), {
                uid: c.user.uid, name: n, email: e, bio: "Available",
                avatar: "https://picsum.photos/200", followers: [], following: [],
                postCount: 0, walletBalance: 0, storyStreak: 0,
                membershipStatus: 'none', membershipRequest: 'none',
                verificationStatus: "none"
            });
        }
    } catch (err) { showToast("Authentication failed."); }
    document.getElementById('global-loader').classList.add('hidden');
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().isBlocked) {
            showToast("Your account has been blocked by Admin.");
            await signOut(auth);
            return;
        }

        currentUser = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');

        if (user.email === "sudeep@gmail.com" || user.email === "admin@gmail.com") {
            document.getElementById('adminPanelBtn').style.display = 'block';
        } else {
            document.getElementById('adminPanelBtn').style.display = 'none';
        }

        loadAllData();
        listenToNotifications();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }

    setTimeout(() => {
        document.getElementById('splash-screen').style.opacity = '0';
        setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 500);
    }, 800);
});

window.askLogout = () => {
    window.openProConfirm("Log Out of Insta Story?", () => signOut(auth));
};

// ==========================================
// Data Loading
// ==========================================
async function loadPostsPagination() {
    if (isLoadingPosts) return;
    isLoadingPosts = true;

    let postQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(25));
    if (lastVisiblePost) {
        postQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"), startAfter(lastVisiblePost), limit(25));
    }

    const snap = await getDocs(postQuery);
    if (snap.empty) {
        isLoadingPosts = false;
        document.getElementById('global-loader').classList.add('hidden');
        return;
    }

    lastVisiblePost = snap.docs[snap.docs.length - 1];

    snap.forEach(doc => {
        let existing = allPosts.find(p => p.id === doc.id);
        if (!existing) allPosts.push({ id: doc.id, ...doc.data() });
    });

    await renderHomeFeed();
    document.getElementById('global-loader').classList.add('hidden');
    isLoadingPosts = false;
}

window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        if (document.getElementById('home-page').classList.contains('active')) {
            loadPostsPagination();
        }
    }
});

function loadAllData() {
    document.getElementById('global-loader').classList.remove('hidden');
    document.getElementById('loader-text').innerText = "Loading Feed...";

    getDocs(collection(db, "users")).then((snap) => {
        allUsers = [];
        snap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));

        const myUsr = allUsers.find(u => u.uid === currentUser.uid);
        if (myUsr && myUsr.avatar) {
            const cAvatar = document.getElementById('my-comment-avatar');
            if (cAvatar) cAvatar.src = myUsr.avatar;
        }

        if (document.getElementById('explore-page').classList.contains('active')) switchLeaderboard('normal');
        if (document.getElementById('profile-page').classList.contains('active')) loadProfile();
        if (document.getElementById('messages-page').classList.contains('active')) renderMessagesList();
        renderStoryBar();
    });

    loadPostsPagination();

    onSnapshot(collection(db, "stories"), (snap) => {
        const now = Date.now();
        groupedStories = {};
        myActiveStories = [];
        snap.forEach(docData => {
            const data = { id: docData.id, ...docData.data() };
            if (data.expiresAt && data.expiresAt.toMillis() > now) {
                if (data.uid === currentUser.uid) myActiveStories.push(data);
                else {
                    if (!groupedStories[data.uid]) groupedStories[data.uid] = [];
                    groupedStories[data.uid].push(data);
                }
            }
        });
        Object.keys(groupedStories).forEach(key => {
            groupedStories[key].sort((a, b) => a.timestamp?.toMillis?.() - b.timestamp?.toMillis?.() || 0);
        });
        renderStoryBar();
    });
}

async function sendNotification(toUid, type, postId = null) {
    if (toUid === currentUser.uid) return;
    await addDoc(collection(db, 'notifications'), {
        fromUid: currentUser.uid, toUid: toUid, type: type, postId: postId, timestamp: Date.now()
    });
}

function listenToNotifications() {
    onSnapshot(collection(db, 'notifications'), (snap) => {
        let notifs = [];
        let newNotifCount = 0;
        let lastCheck = localStorage.getItem('lastNotifCheck') || 0;

        snap.forEach(doc => {
            const data = doc.data();
            if (data.toUid === currentUser.uid) {
                notifs.push({ id: doc.id, ...data });
                if (data.timestamp > lastCheck) newNotifCount++;
            }
        });

        notifs.sort((a, b) => b.timestamp - a.timestamp);
        const list = document.getElementById('notifications-list');
        list.innerHTML = '';

        if (newNotifCount > 0 && document.getElementById('notifications-page').className.indexOf('active') === -1) {
            const badge = document.getElementById('notif-badge-indicator');
            badge.innerText = newNotifCount > 9 ? '9+' : newNotifCount;
            badge.style.display = 'flex';
        }

        if (notifs.length === 0) {
            list.innerHTML = '<p style="padding:20px; text-align:center; color:#8e8e8e;">No new notifications.</p>';
            return;
        }
        notifs.forEach(n => {
            const u = allUsers.find(usr => usr.uid === n.fromUid) || { name: 'Someone', avatar: 'https://picsum.photos/100' };
            let txt = n.type === 'like' ? 'liked your post.' : n.type === 'comment' ? 'commented on your post.' : 'started following you.';
            const div = document.createElement('div');
            div.className = 'list-item';
            div.onclick = () => viewProfile(n.fromUid);
            div.innerHTML = `<img src="${u.avatar}"><div class="list-item-content"><strong>${u.name}</strong><span>${txt}</span></div>`;
            list.appendChild(div);
        });
    });
}

// ==========================================
// Feed Render
// ==========================================
function attachDoubleTapLike(wrap, post) {
    let lastT = 0;
    wrap.addEventListener('click', (e) => {
        if (e.target.closest('.audio-toggle-btn')) return;
        const now = Date.now();
        if (now - lastT < 300) {
            const isCurrentlyLiked = post.likes && post.likes.includes(currentUser.uid);
            const r = wrap.getBoundingClientRect();
            const h = document.createElement('div');
            h.className = 'like-animation';
            h.innerHTML = `<svg width="80" height="80" viewBox="0 0 24 24" fill="#ed4956" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
            h.style.left = (e.clientX - r.left) + 'px';
            h.style.top = (e.clientY - r.top) + 'px';
            wrap.appendChild(h);
            setTimeout(() => h.remove(), 600);

            if (!isCurrentlyLiked) {
                window.togglePostLike(post.id, post.uid, false);
            }
        }
        lastT = now;
    });
}

function getMixedFeed() {
    if (!currentUser) return allPosts;
    const myUserObj = allUsers.find(u => u.uid === currentUser.uid);
    const myFollowing = myUserObj ? (myUserObj.following || []) : [];

    let followed = [];
    let others = [];

    allPosts.forEach(p => {
        if (myFollowing.includes(p.uid) || p.uid === currentUser.uid) followed.push(p);
        else others.push(p);
    });

    const sortFn = (a, b) => {
        let ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
        let tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
        return tb - ta;
    };
    followed.sort(sortFn);
    others.sort(sortFn);

    let mixed = [], fIdx = 0, oIdx = 0, lastUid = null;

    while (fIdx < followed.length || oIdx < others.length) {
        let candidate = null;
        if (fIdx < followed.length && followed[fIdx].uid !== lastUid) candidate = followed[fIdx++];
        else if (oIdx < others.length && others[oIdx].uid !== lastUid) candidate = others[oIdx++];
        else if (fIdx < followed.length) candidate = followed[fIdx++];
        else if (oIdx < others.length) candidate = others[oIdx++];

        if (candidate) {
            mixed.push(candidate);
            lastUid = candidate.uid;
        }
    }
    return mixed;
}

function renderHomeFeed() {
    const feed = document.getElementById("home-feed");
    feed.innerHTML = '';
    const mixedPosts = getMixedFeed();

    mixedPosts.forEach(post => {
        const u = allUsers.find(usr => usr.uid === post.uid) || { name: 'User', avatar: 'https://picsum.photos/100', verificationStatus: 'none', membershipStatus: 'none' };
        const isLiked = post.likes && post.likes.includes(currentUser.uid);
        const isOwnPost = post.uid === currentUser.uid;
        const userStories = groupedStories[post.uid] || [];
        const hasUnviewedStory = userStories.some(s => !hasViewedStory(s.id));
        const isVer = u.verificationStatus === 'verified' ? `<i class="fa-solid fa-circle-check" style="color:#0095f6; font-size:12px; margin-left:3px;"></i>` : '';
        const isMember = u.membershipStatus === 'active' ? `<span class="member-badge"><i class="fa-solid fa-crown"></i> PRO</span>` : '';

        let avatarHtml = `<img src="${u.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`;
        if (hasUnviewedStory) avatarHtml = `<div class="feed-story-ring has-story"><img src="${u.avatar}"></div>`;

        let videoMuted = post.musicUrl ? 'muted' : '';
        let mediaHtml = post.mediaUrl.match(/\.(mp4|webm|mov)$/i)
            ? `<video class="post-media" src="${post.mediaUrl}" controls loop ${videoMuted}></video>`
            : `<img class="post-media" src="${post.mediaUrl}">`;

        let audioHtml = post.musicUrl ? `
            <audio id="post-audio-${post.id}" src="${post.musicUrl}" loop preload="auto"></audio>
            <div class="audio-toggle-btn" onclick="togglePostAudio('${post.id}')" id="audio-btn-${post.id}"><i class="fas fa-volume-mute"></i></div>
            <div style="padding: 6px 15px; font-size:12px; color:#262626; background:#fafafa; border-bottom:1px solid #efefef; display:flex; align-items:center;">
                <i class="fas fa-music" style="color:#0095f6; margin-right:8px; animation:spin 3s linear infinite;"></i> 
                <marquee scrollamount="4" style="width:100%; vertical-align:middle; font-weight:500;">${post.musicName} • Original Audio</marquee>
            </div>
        ` : '';

        const div = document.createElement('div');
        div.className = 'post-card';
        div.setAttribute('data-post-id', post.id);

        div.innerHTML = `
            <div class="post-header">
                <div class="post-user-info" onclick="handleFeedProfileClick('${post.uid}')">${avatarHtml}<span>${u.name}${isVer}${isMember}</span></div>
                ${isOwnPost ? `<i class="fa-regular fa-trash-can delete-post-btn" onclick="askDeletePost('${post.id}')"></i>` : ''}
            </div>
            <div class="post-media-wrapper" id="post-wrapper-${post.id}">
                ${mediaHtml}
                ${audioHtml}
            </div>
            <div class="post-actions" id="action-div-${post.id}">
                <i class="${isLiked ? 'fa-solid liked' : 'fa-regular'} fa-heart" onclick="togglePostLike('${post.id}', '${post.uid}', ${isLiked})" style="${isLiked ? 'color:#ed4956;' : ''}"></i>
                <i class="fa-regular fa-comment" onclick="openComments('${post.id}', '${post.uid}')"></i>
                <i class="fa-regular fa-paper-plane" onclick="openShareModal('${post.id}')"></i>
            </div>
            <div class="post-likes" style="display:flex; justify-content:space-between; align-items:center;">
                <span id="likes-count-${post.id}" onclick="openPostLikes('${post.id}')">${post.likes ? post.likes.length : 0} likes</span>
                <span id="views-count-${post.id}" style="color:#8e8e8e; font-weight:500;"><i class="fa-solid fa-eye"></i> ${post.views || 0}</span>
            </div>
            ${post.caption ? `<div class="post-caption" style="padding-bottom:5px;"><span>${u.name}</span> ${post.caption}</div>` : ''}
            <div style="font-size:10px; color:#8e8e8e; padding: 0 15px 15px 15px; font-weight:500;">${formatPostDate(post.timestamp)}</div>
        `;
        feed.appendChild(div);

        const wrap = div.querySelector(`#post-wrapper-${post.id}`);
        if (wrap) attachDoubleTapLike(wrap, post);
    });

    if (window.feedObserver) window.feedObserver.disconnect();

    window.feedObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const audios = entry.target.querySelectorAll('audio');
            const videos = entry.target.querySelectorAll('video');

            if (entry.isIntersecting) {
                let pid = entry.target.getAttribute('data-post-id');
                if (pid && !window.viewedPostsSession.has(pid)) {
                    window.viewedPostsSession.add(pid);
                    let p = allPosts.find(x => x.id === pid);
                    if (p) {
                        p.views = (p.views || 0) + 1;
                        let vElem = document.getElementById(`views-count-${pid}`);
                        if (vElem) vElem.innerHTML = `<i class="fa-solid fa-eye"></i> ${p.views}`;
                        updateDoc(doc(db, "posts", pid), { views: increment(1) }).catch(e => console.log(e));
                    }
                }

                videos.forEach(video => { let p = video.play(); if (p !== undefined) p.catch(e => console.log('blocked')); });
                audios.forEach(audio => {
                    document.querySelectorAll('audio[id^="post-audio-"]').forEach(a => {
                        if (a !== audio && !a.paused) {
                            a.pause();
                            const b = document.getElementById(a.id.replace('post-audio-', 'audio-btn-'));
                            if (b) { b.innerHTML = '<i class="fas fa-volume-mute"></i>'; b.classList.remove('playing'); }
                        }
                    });
                    let p = audio.play();
                    if (p !== undefined) {
                        p.then(() => {
                            const btnElem = document.getElementById(audio.id.replace('post-audio-', 'audio-btn-'));
                            if (btnElem) { btnElem.innerHTML = '<i class="fas fa-volume-up"></i>'; btnElem.classList.add('playing'); }
                        }).catch(e => console.log('Audio blocked'));
                    }
                });
            } else {
                audios.forEach(audio => {
                    if (!audio.paused) {
                        audio.pause();
                        const btnElem = document.getElementById(audio.id.replace('post-audio-', 'audio-btn-'));
                        if (btnElem) { btnElem.innerHTML = '<i class="fas fa-volume-mute"></i>'; btnElem.classList.remove('playing'); }
                    }
                });
                videos.forEach(video => { if (!video.paused) video.pause(); });
            }
        });
    }, { threshold: 0.6 });

    const postCards = feed.querySelectorAll('.post-card');
    postCards.forEach(card => window.feedObserver.observe(card));
}

window.handleFeedProfileClick = (uid) => {
    const userStories = groupedStories[uid] || [];
    const hasUnviewed = userStories.some(s => !hasViewedStory(s.id));
    if (hasUnviewed) startStoryViewer(uid, false);
    else viewProfile(uid);
};

window.togglePostAudio = (postId) => {
    const audioElem = document.getElementById(`post-audio-${postId}`);
    const btnElem = document.getElementById(`audio-btn-${postId}`);
    if (!audioElem || !btnElem) return;

    if (audioElem.paused) {
        document.querySelectorAll('audio[id^="post-audio-"]').forEach(a => {
            if (a.id !== `post-audio-${postId}`) {
                a.pause();
                const b = document.getElementById(a.id.replace('post-audio-', 'audio-btn-'));
                if (b) b.innerHTML = '<i class="fas fa-volume-mute"></i>';
            }
        });
        let p = audioElem.play();
        if (p !== undefined) p.catch(e => console.log('blocked'));
        btnElem.innerHTML = '<i class="fas fa-volume-up"></i>';
        btnElem.classList.add('playing');
    } else {
        audioElem.pause();
        btnElem.innerHTML = '<i class="fas fa-volume-mute"></i>';
        btnElem.classList.remove('playing');
    }
};
// ==========================================
// Explore & Search
// ==========================================
window.searchUsers = () => {
    const q = document.getElementById("exploreSearch").value.trim().toLowerCase();
    if (q.length > 0) {
        document.getElementById("explore-leaderboard").classList.add("hidden");
        document.getElementById("explore-grid").classList.remove("hidden");
        renderExploreGrid(q);
    } else {
        document.getElementById("explore-leaderboard").classList.remove("hidden");
        document.getElementById("explore-grid").classList.add("hidden");
        switchLeaderboard('normal');
    }
};

function renderExploreGrid(q) {
    const grid = document.getElementById("explore-grid");
    grid.innerHTML = '';
    let f = allUsers.filter(u => u.uid !== currentUser.uid);
    if (q) f = f.filter(u => (u.name || '').toLowerCase().includes(q));
    f.forEach(user => {
        const div = document.createElement('div');
        div.className = 'grid-item';
        div.onclick = () => viewProfile(user.uid);
        div.innerHTML = `<img src="${user.avatar || 'https://picsum.photos/200'}">`;
        grid.appendChild(div);
    });
}

// ==========================================
// Leaderboard
// ==========================================
window.switchLeaderboard = (type) => {
    if (type === 'normal') {
        document.getElementById('btn-lb-normal').classList.add('primary');
        document.getElementById('btn-lb-blue').classList.remove('primary');
        document.getElementById('lb-rules-text').innerText = "Rules: মেম্বারশিপ নেওয়া ইউজারদের র‍্যাংকিং। ৩ মাস বা মোট ৩ বার ১ম হলে অটো ব্লু টিক!";
    } else {
        document.getElementById('btn-lb-blue').classList.add('primary');
        document.getElementById('btn-lb-normal').classList.remove('primary');
        document.getElementById('lb-rules-text').innerText = "Rules: ব্লু টিক ভেরিফাইড ইউজারদের র‍্যাংকিং। মাসে ১ম স্থানে থাকলে ৫০০ টাকা পুরস্কার।";
    }
    renderLeaderboardList(type);
};

function renderLeaderboardList(type) {
    const list = document.getElementById('leaderboard-list');
    const myRankBanner = document.getElementById('my-rank-banner');
    list.innerHTML = '';
    if (myRankBanner) myRankBanner.style.display = 'none';

    let filtered = [...allUsers];
    if (type === 'normal') {
        filtered = filtered.filter(u => u.membershipStatus === 'active' && u.verificationStatus !== 'verified');
    } else {
        filtered = filtered.filter(u => u.verificationStatus === 'verified');
    }

    filtered.sort((a, b) => {
        const sA = (a.postCount || 0) * 10 + (a.followers || []).length * 5;
        const sB = (b.postCount || 0) * 10 + (b.followers || []).length * 5;
        return sB - sA;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding: 20px; color:#8e8e8e;">কোনো ইউজার পাওয়া যায়নি।</p>';
        return;
    }

    const myUid = currentUser ? currentUser.uid : null;
    const myIndex = filtered.findIndex(u => u.uid === myUid);

    if (myRankBanner && myIndex !== -1) {
        const myData = filtered[myIndex];
        const myScore = (myData.postCount || 0) * 10 + (myData.followers || []).length * 5;
        myRankBanner.style.display = 'block';
        myRankBanner.innerHTML = `
            <div style="background: linear-gradient(135deg, #0095f6, #00c6ff); color: #fff; padding: 12px 15px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,149,246,0.25);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 18px; font-weight: 700; background: rgba(255,255,255,0.2); width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">#${myIndex + 1}</span>
                    <div>
                        <div style="font-weight: 600; font-size: 14px;">আপনার অবস্থান (You)</div>
                        <div style="font-size: 11px; opacity: 0.9;">Score: ${myScore} pts</div>
                    </div>
                </div>
                <button onclick="viewProfile('${myData.uid}')" style="background: #fff; color: #0095f6; border: none; border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer;">প্রোফাইল</button>
            </div>
        `;
    }

    filtered.forEach((u, index) => {
        const score = (u.postCount || 0) * 10 + (u.followers || []).length * 5;
        const isMe = u.uid === myUid;
        const div = document.createElement('div');
        div.className = 'list-item';
        div.onclick = () => viewProfile(u.uid);

        if (isMe) {
            div.style.background = '#f0f8ff';
            div.style.borderLeft = '3px solid #0095f6';
        }

        let rankColor = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : '#8e8e8e';
        let rankIcon = index === 0 ? '👑 ' : '';
        const vTick = u.verificationStatus === 'verified' ? '<i class="fa-solid fa-circle-check" style="color:#0095f6; font-size:12px; margin-left:5px;"></i>' : '';

        div.innerHTML = `
            <div style="width: 35px; font-weight: bold; color: ${rankColor}; font-size: 15px;">${rankIcon}#${index + 1}</div>
            <img src="${u.avatar || 'https://picsum.photos/100'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border: 1px solid #efefef;">
            <div class="list-item-content" style="flex:1;">
                <strong>${u.name || 'User'} ${isMe ? '<span style="font-size:11px; color:#0095f6;">(You)</span>' : ''} ${vTick}</strong>
                <span style="font-size: 11px; color: #8e8e8e;">Score: ${score}</span>
            </div>
            ${index < 3 ? `<i class="fa-solid fa-medal" style="color:${rankColor}; font-size:18px;"></i>` : ''}
        `;
        list.appendChild(div);
    });
}

// ==========================================
// Story Bar
// ==========================================
function hasViewedStory(storyId) { return viewedStories[storyId] === true; }

function renderStoryBar() {
    const cont = document.getElementById("story-container");
    cont.innerHTML = '';
    const m = document.createElement('div');
    m.className = 'story-item';
    if (myActiveStories.length > 0) {
        const t = myActiveStories[myActiveStories.length - 1].mediaUrl.replace(/\.(mp4|webm|mov)$/i, '.jpg');
        m.innerHTML = `<div class="story-ring" style="border: 2px solid #dbdbdb; background: transparent;"><img src="${t}"></div><span class="story-name">Your Story</span>`;
        m.onclick = () => startStoryViewer(currentUser.uid, true);
    } else {
        m.innerHTML = `<div class="story-ring add-story"><i class="fa-solid fa-plus" style="font-size: 24px; color: #8e8e8e;"></i></div><span class="story-name">Your Story</span>`;
        m.onclick = () => openUploadMenu();
    }
    cont.appendChild(m);

    const sortedUsers = Object.keys(groupedStories).sort((a, b) => {
        const aViewed = groupedStories[a].every(s => hasViewedStory(s.id));
        const bViewed = groupedStories[b].every(s => hasViewedStory(s.id));
        if (aViewed && !bViewed) return 1;
        if (!aViewed && bViewed) return -1;
        return 0;
    });

    sortedUsers.forEach(uid => {
        const u = allUsers.find(usr => usr.uid === uid) || { name: 'User', avatar: 'https://picsum.photos/100' };
        const stories = groupedStories[uid];
        const hasUnviewed = stories.some(s => !hasViewedStory(s.id));
        const t = stories[stories.length - 1].mediaUrl.replace(/\.(mp4|webm|mov)$/i, '.jpg');
        const div = document.createElement('div');
        div.className = 'story-item';

        let ringClass = 'story-ring';
        if (hasUnviewed) ringClass += ' has-story';
        else ringClass += ' viewed';

        div.innerHTML = `<div class="${ringClass}"><img src="${t}"></div><span class="story-name">${u.name}</span>`;
        div.onclick = () => { startStoryViewer(uid, false); };
        cont.appendChild(div);
    });
}

// ==========================================
// Post Viewer
// ==========================================
window.openPostViewer = (postId) => {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return showToast("Post unavailable");

    const userObj = allUsers.find(u => u.uid === post.uid) || { name: 'User', avatar: 'https://picsum.photos/100', verificationStatus: 'none', membershipStatus: 'none' };
    const isLiked = post.likes && post.likes.includes(currentUser.uid);
    const likeCount = post.likes ? post.likes.length : 0;
    const isVer = userObj.verificationStatus === 'verified' ? `<i class="fa-solid fa-circle-check" style="color:#0095f6; font-size:12px; margin-left:3px;"></i>` : '';
    const isMem = userObj.membershipStatus === 'active' ? `<span class="member-badge"><i class="fa-solid fa-crown"></i> PRO</span>` : '';

    document.getElementById('pv-user-info').innerHTML = `<img src="${userObj.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;"><span>${userObj.name}${isVer}${isMem}</span>`;
    const mediaContainer = document.getElementById('pv-media');

    let videoMuted = post.musicUrl ? 'muted' : '';
    let mediaHtml = post.mediaUrl.match(/\.(mp4|webm|mov)$/i)
        ? `<video src="${post.mediaUrl}" controls ${videoMuted} style="max-width:100%; max-height:50vh;"></video>`
        : `<img src="${post.mediaUrl}" style="max-width:100%; max-height:50vh; object-fit:contain;">`;

    if (post.musicUrl) {
        mediaHtml += `
            <audio id="pv-audio" src="${post.musicUrl}" loop></audio>
            <div class="audio-toggle-btn playing" onclick="togglePvAudio()" id="pv-audio-btn" style="bottom: 40px;"><i class="fas fa-volume-up"></i></div>
            <div style="position:absolute; bottom:0; left:0; width:100%; padding: 6px 15px; font-size:12px; color:#fff; background:rgba(0,0,0,0.5); display:flex; align-items:center;">
                <i class="fas fa-music" style="margin-right:8px; animation:spin 3s linear infinite;"></i> 
                <marquee scrollamount="4" style="width:100%; vertical-align:middle; font-weight:500;">${post.musicName || 'Original Audio'}</marquee>
            </div>
        `;
    }
    mediaContainer.innerHTML = mediaHtml;

    if (post.musicUrl) {
        setTimeout(() => {
            const pvAudio = document.getElementById('pv-audio');
            if (pvAudio) {
                let playPromise = pvAudio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        const btn = document.getElementById('pv-audio-btn');
                        if (btn) { btn.innerHTML = '<i class="fas fa-volume-mute"></i>'; btn.classList.remove('playing'); }
                    });
                }
            }
        }, 100);
    }

    document.getElementById('pv-actions').innerHTML = `<i id="pv-heart-icon" class="${isLiked ? 'fa-solid liked' : 'fa-regular'} fa-heart" style="${isLiked ? 'color:#ed4956;' : ''} cursor:pointer;" onclick="toggleModalLike('${post.id}', '${post.uid}')"></i><i class="fa-regular fa-comment" style="cursor:pointer; margin-left:15px;" onclick="openComments('${post.id}', '${post.uid}')"></i><i class="fa-regular fa-paper-plane" style="cursor:pointer; margin-left:15px;" onclick="openShareModal('${post.id}')"></i>`;

    document.getElementById('pv-caption').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <div class="post-likes" id="pv-likes" style="padding:0;">${likeCount} likes</div>
            <div style="color:#8e8e8e; font-weight:500; font-size:13px;"><i class="fa-solid fa-eye"></i> ${post.views || 0} views</div>
        </div>
        ${post.caption ? `<div><span>${userObj.name}</span> ${post.caption}</div>` : ''}
        <div style="font-size:10px; color:#8e8e8e; margin-top:5px; font-weight:500;">${formatPostDate(post.timestamp)}</div>
    `;

    document.getElementById('post-viewer-modal').classList.remove('hidden');

    if (post.id && !window.viewedPostsSession.has(post.id)) {
        window.viewedPostsSession.add(post.id);
        post.views = (post.views || 0) + 1;
        updateDoc(doc(db, "posts", post.id), { views: increment(1) }).catch(e => console.log(e));
    }
};

window.togglePvAudio = () => {
    const aud = document.getElementById('pv-audio');
    const btn = document.getElementById('pv-audio-btn');
    if (!aud || !btn) return;
    if (aud.paused) {
        aud.play();
        btn.innerHTML = '<i class="fas fa-volume-up"></i>';
        btn.classList.add('playing');
    } else {
        aud.pause();
        btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        btn.classList.remove('playing');
    }
};

window.toggleModalLike = async (postId, postOwnerUid) => {
    const post = allPosts.find(p => p.id === postId);
    const isCurrentlyLiked = post && post.likes && post.likes.includes(currentUser.uid);

    const heart = document.getElementById('pv-heart-icon');
    const likesText = document.getElementById('pv-likes');
    let count = post && post.likes ? post.likes.length : 0;

    if (isCurrentlyLiked) {
        heart.className = 'fa-regular fa-heart';
        heart.style.color = '';
        count = Math.max(0, count - 1);
    } else {
        heart.className = 'fa-solid fa-heart liked';
        heart.style.color = '#ed4956';
        count += 1;
        heart.style.transform = 'scale(1.2)';
        setTimeout(() => heart.style.transform = 'scale(1)', 150);
    }
    likesText.innerText = `${count} likes`;

    await window.togglePostLike(postId, postOwnerUid, isCurrentlyLiked);
};

// ==========================================
// Profile
// ==========================================
window.viewProfile = (uid = currentUser.uid) => {
    currentProfileViewUid = uid;
    navigateTo('profile');
};

async function loadProfile() {
    if (!currentUser) return;
    const uid = currentProfileViewUid || currentUser.uid;
    let u = allUsers.find(usr => usr.uid === uid);

    if (!u) {
        if (uid === currentUser.uid) u = { name: "My Profile", bio: "Available", avatar: "https://picsum.photos/200", followers: [], following: [], verificationStatus: 'none', membershipStatus: 'none' };
        else return;
    }

    document.getElementById("profile-top-name").innerText = u.name || "Profile";
    document.getElementById("profile-name").innerHTML = (u.name || "User")
        + (u.verificationStatus === 'verified' ? ` <i class="fa-solid fa-circle-check" style="color:#0095f6; font-size:14px; margin-left:5px;"></i>` : '')
        + (u.membershipStatus === 'active' ? `<span class="member-badge" style="font-size:12px;"><i class="fa-solid fa-crown"></i> PRO</span>` : '');
    document.getElementById("profile-bio-text").innerText = u.bio || "";
    document.getElementById("profile-page-avatar").src = u.avatar || "https://picsum.photos/200";
    document.getElementById("stat-followers").innerText = (u.followers || []).length;
    document.getElementById("stat-following").innerText = (u.following || []).length;

    const ac = document.getElementById("profile-action-container");
    const ab = document.getElementById("edit-avatar-btn");
    const menuIcon = document.getElementById("profile-menu-icon");

    if (uid === currentUser.uid) {
        ac.innerHTML = `<button class="action-btn" onclick="window.openEditProfile()">Edit Profile</button><button class="creator-btn" onclick="navigateTo('creator-hub')"><i class="fa-solid fa-chart-line"></i> Creator Hub</button>
                        <button id="adminPanelBtn" class="action-btn" style="background:#dc3545; color:white; display:${(currentUser.email === "sudeep@gmail.com" || currentUser.email === "admin@gmail.com") ? 'block' : 'none'};" onclick="navigateTo('admin-panel')">
                            <i class="fa-solid fa-shield-halved"></i> Admin Panel
                        </button>`;
        ab.style.display = 'flex';
        menuIcon.style.display = 'block';
    } else {
        const isFol = (u.followers || []).includes(currentUser.uid);
        ac.innerHTML = `<button class="action-btn ${isFol ? '' : 'primary'}" id="profile-follow-btn" onclick="toggleFollow('${uid}', ${isFol})">${isFol ? 'Following' : 'Follow'}</button>
                        <button class="action-btn" onclick="openChat('${uid}')">Message</button>`;
        ab.style.display = 'none';
        menuIcon.style.display = 'none';
    }

    const grid = document.getElementById("profile-posts");
    grid.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';

    const q = query(collection(db, "posts"), where("uid", "==", uid));

    getDocs(q).then((snap) => {
        grid.innerHTML = '';

        let userPosts = [];
        snap.forEach(docSnap => {
            userPosts.push({ id: docSnap.id, ...docSnap.data() });
        });

        userPosts.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
            return timeB - timeA;
        });

        document.getElementById("stat-posts").innerText = userPosts.length;

        if (userPosts.length === 0) {
            grid.innerHTML = '<p style="text-align:center; width:100%; padding:20px; color:#8e8e8e;">No posts yet.</p>';
            return;
        }

        userPosts.forEach(p => {
            if (!allPosts.find(x => x.id === p.id)) allPosts.push(p);

            const div = document.createElement('div');
            div.className = 'grid-item';
            div.onclick = () => openPostViewer(p.id);
            div.innerHTML = p.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? `<video src="${p.mediaUrl}" muted></video>` : `<img src="${p.mediaUrl}">`;
            grid.appendChild(div);
        });
    }).catch(e => {
        console.error(e);
        grid.innerHTML = '<p style="text-align:center; width:100%; padding:20px; color:#8e8e8e;">No posts found.</p>';
    });
}

// ==========================================
// Profile Menu
// ==========================================
window.openProfileMenu = () => document.getElementById('profile-menu-modal').classList.remove('hidden');
window.openAboutApp = () => {
    document.getElementById('profile-menu-modal').classList.add('hidden');
    document.getElementById('about-app-modal').classList.remove('hidden');
};
window.openPrivacyPolicy = () => {
    document.getElementById('profile-menu-modal').classList.add('hidden');
    document.getElementById('privacy-policy-modal').classList.remove('hidden');
};

window.openVerificationMenu = async () => {
    document.getElementById('profile-menu-modal').classList.add('hidden');
    checkAndShowVerificationModal();
};

async function checkAndShowVerificationModal() {
    const uRef = doc(db, "users", currentUser.uid);
    const uSnap = await getDoc(uRef);
    const uData = uSnap.data();

    const notice = document.getElementById('verification-notice');
    if (uData.verificationStatus === 'rejected') {
        const rejectDate = uData.verificationLastRejected ? uData.verificationLastRejected.toMillis() : 0;
        const daysPassed = (Date.now() - rejectDate) / (1000 * 60 * 60 * 24);
        if (daysPassed < 90) notice.style.display = 'block';
        else { notice.style.display = 'none'; await updateDoc(uRef, { verificationStatus: 'none' }); }
    } else notice.style.display = 'none';

    if (uData.verificationStatus === 'pending') return showToast("Your verification request is pending admin review.");
    if (uData.verificationStatus === 'verified') return showToast("Your account is already verified!");

    document.getElementById('verification-modal').classList.remove('hidden');
}

window.applyForVerification = async () => {
    const uRef = doc(db, "users", currentUser.uid);
    const uSnap = await getDoc(uRef);
    const uData = uSnap.data();

    if (uData.verificationStatus === 'rejected') {
        const rejectDate = uData.verificationLastRejected ? uData.verificationLastRejected.toMillis() : 0;
        const daysPassed = (Date.now() - rejectDate) / (1000 * 60 * 60 * 24);
        if (daysPassed < 90) return showToast(`You must wait ${Math.ceil(90 - daysPassed)} more days to apply again.`);
    }

    const followers = (uData.followers || []).length;
    if (followers >= 100) {
        await updateDoc(uRef, { verificationStatus: 'pending' });
        showToast("Request submitted successfully! Admin will review.");
        document.getElementById('verification-modal').classList.add('hidden');
    } else {
        showToast("Need at least 100 followers to apply for free.");
    }
};

// ==========================================
// Follow & Like
// ==========================================
window.toggleFollow = async (targetUid, isFollowing) => {
    const targetUser = allUsers.find(u => u.uid === targetUid);
    const myUser = allUsers.find(u => u.uid === currentUser.uid);

    if (targetUser) {
        if (!targetUser.followers) targetUser.followers = [];
        if (isFollowing) targetUser.followers = targetUser.followers.filter(id => id !== currentUser.uid);
        else if (!targetUser.followers.includes(currentUser.uid)) targetUser.followers.push(currentUser.uid);
    }
    if (myUser) {
        if (!myUser.following) myUser.following = [];
        if (isFollowing) myUser.following = myUser.following.filter(id => id !== targetUid);
        else if (!myUser.following.includes(targetUid)) myUser.following.push(targetUid);
    }

    const btn = document.getElementById('profile-follow-btn');
    if (btn && currentProfileViewUid === targetUid) {
        if (isFollowing) {
            btn.innerText = 'Follow';
            btn.classList.add('primary');
        } else {
            btn.innerText = 'Following';
            btn.classList.remove('primary');
        }
        btn.setAttribute('onclick', `toggleFollow('${targetUid}', ${!isFollowing})`);
        const followersStat = document.getElementById("stat-followers");
        if (followersStat) {
            let count = parseInt(followersStat.innerText) || 0;
            followersStat.innerText = isFollowing ? Math.max(0, count - 1) : count + 1;
        }
    }

    const tr = doc(db, "users", targetUid);
    const mr = doc(db, "users", currentUser.uid);
    if (isFollowing) {
        await updateDoc(tr, { followers: arrayRemove(currentUser.uid) });
        await updateDoc(mr, { following: arrayRemove(targetUid) });
    } else {
        await updateDoc(tr, { followers: arrayUnion(currentUser.uid) });
        await updateDoc(mr, { following: arrayUnion(targetUid) });
        sendNotification(targetUid, 'follow');
    }
};

window.togglePostLike = async (postId, postOwnerUid, isCurrentlyLiked) => {
    const post = allPosts.find(p => p.id === postId);
    if (post) {
        if (!post.likes) post.likes = [];
        if (isCurrentlyLiked) post.likes = post.likes.filter(uid => uid !== currentUser.uid);
        else if (!post.likes.includes(currentUser.uid)) post.likes.push(currentUser.uid);
    }

    const actionDiv = document.getElementById(`action-div-${postId}`);
    if (actionDiv) {
        const heartIcon = actionDiv.querySelector('.fa-heart');
        if (heartIcon) {
            heartIcon.className = isCurrentlyLiked ? 'fa-regular fa-heart' : 'fa-solid fa-heart liked';
            heartIcon.style.color = isCurrentlyLiked ? '' : '#ed4956';
            heartIcon.setAttribute('onclick', `togglePostLike('${postId}', '${postOwnerUid}', ${!isCurrentlyLiked})`);
        }
    }
    const likesCountDiv = document.getElementById(`likes-count-${postId}`);
    if (likesCountDiv && post) likesCountDiv.innerText = `${post.likes.length} likes`;

    const pr = doc(db, "posts", postId);
    if (isCurrentlyLiked) {
        await updateDoc(pr, { likes: arrayRemove(currentUser.uid) });
    } else {
        await updateDoc(pr, { likes: arrayUnion(currentUser.uid) });
        sendNotification(postOwnerUid, 'like', postId);
    }
};

// ==========================================
// Comments
// ==========================================
window.openComments = (postId, ownerUid) => {
    actComId = postId;
    actComOwn = ownerUid;
    document.getElementById('comments-modal').classList.remove('hidden');
    renderComments();
};

function renderComments() {
    const p = allPosts.find(pt => pt.id === actComId);
    const l = document.getElementById('comments-list');
    l.innerHTML = '';

    if (p && p.comments && p.comments.length > 0) {
        p.comments.forEach(c => {
            const u = allUsers.find(usr => usr.uid === c.uid) || { name: 'User', avatar: 'https://picsum.photos/100' };
            const d = document.createElement('div');
            d.style.display = 'flex';
            d.style.gap = '12px';
            d.style.marginBottom = '15px';
            d.innerHTML = `
                <img src="${u.avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; cursor:pointer;" onclick="closeModals(null); viewProfile('${u.uid}')">
                <div style="flex:1;">
                    <div style="font-size:13px; line-height:1.4;">
                        <strong style="cursor:pointer;" onclick="closeModals(null); viewProfile('${u.uid}')">${u.name}</strong> 
                        <span>${c.text}</span>
                    </div>
                    <div style="font-size:11px; color:#8e8e8e; margin-top:5px; display:flex; gap:15px; align-items:center;">
                        <span>${formatPostDate(c.timestamp)}</span>
                        <span style="font-weight:600; cursor:pointer;" onclick="replyToComment('${u.name.replace(/'/g, "\\'")}')">Reply</span>
                    </div>
                </div>
            `;
            l.appendChild(d);
        });
        l.scrollTop = l.scrollHeight;
    } else {
        l.innerHTML = '<div style="text-align:center; padding:20px; color:#8e8e8e;">No comments yet. Be the first to comment!</div>';
    }
}

window.replyToComment = (username) => {
    const input = document.getElementById('new-comment-text');
    input.value = `@${username} `;
    input.focus();
};

document.getElementById('post-comment-btn').addEventListener('click', async () => {
    const t = document.getElementById('new-comment-text').value.trim();
    if (!t || !actComId) return;

    const newComment = { uid: currentUser.uid, text: t, timestamp: Date.now() };

    const targetPost = allPosts.find(p => p.id === actComId);
    if (targetPost) {
        if (!targetPost.comments) targetPost.comments = [];
        targetPost.comments.push(newComment);
    }

    document.getElementById('new-comment-text').value = '';
    renderComments();

    await updateDoc(doc(db, "posts", actComId), { comments: arrayUnion(newComment) });
    sendNotification(actComOwn, 'comment', actComId);
});

// ==========================================
// Follow List
// ==========================================
window.openPostLikes = (postId) => {
    const p = allPosts.find(pt => pt.id === postId);
    if (!p || !p.likes) return;
    renderSimpleUserList(p.likes, 'follow-list-container');
    document.getElementById('follow-list-title').innerText = 'Likes';
    document.getElementById('follow-list-modal').classList.remove('hidden');
};

window.openFollowList = (type) => {
    const uid = currentProfileViewUid || currentUser.uid;
    const u = allUsers.find(usr => usr.uid === uid);
    if (!u) return;
    renderSimpleUserList(type === 'followers' ? u.followers : u.following, 'follow-list-container');
    document.getElementById('follow-list-title').innerText = type === 'followers' ? 'Followers' : 'Following';
    document.getElementById('follow-list-modal').classList.remove('hidden');
};

function renderSimpleUserList(arr, contId) {
    const c = document.getElementById(contId);
    c.innerHTML = '';
    if (!arr || arr.length === 0) {
        c.innerHTML = '<p style="padding:20px; color:#8e8e8e; text-align:center;">Nothing to show.</p>';
        return;
    }
    arr.forEach(uid => {
        const u = allUsers.find(usr => usr.uid === uid);
        if (u) {
            const d = document.createElement('div');
            d.className = 'follow-list-item';
            d.onclick = () => { closeModals(null); viewProfile(uid); };
            d.innerHTML = `<img src="${u.avatar}"><span>${u.name}</span>`;
            c.appendChild(d);
        }
    });
}

// ==========================================
// Delete Post / Story
// ==========================================
window.askDeletePost = (id) => {
    window.openProConfirm("Delete Post?", async () => {
        document.getElementById('global-loader').classList.remove('hidden');
        await deleteDoc(doc(db, "posts", id));
        allPosts = allPosts.filter(p => p.id !== id);
        renderHomeFeed();
        loadProfile();
        document.getElementById('global-loader').classList.add('hidden');
        showToast("Deleted");
    });
};

window.askDeleteStory = (id) => {
    window.openProConfirm("Delete Story?", async () => {
        closeStoryViewer();
        document.getElementById('global-loader').classList.remove('hidden');
        await deleteDoc(doc(db, "stories", id));
        document.getElementById('global-loader').classList.add('hidden');
        showToast("Deleted");
    });
};

// ==========================================
// Edit Profile
// ==========================================
window.openEditProfile = () => {
    const u = allUsers.find(usr => usr.uid === currentUser.uid);
    if (u) {
        document.getElementById('edit-name').value = u.name || '';
        document.getElementById('edit-bio').value = u.bio || '';
    }
    document.getElementById('edit-profile-modal').classList.remove('hidden');
};

window.saveProfile = async () => {
    const newName = document.getElementById('edit-name').value.trim();
    const newBio = document.getElementById('edit-bio').value.trim();

    document.getElementById('global-loader').classList.remove('hidden');
    try {
        await setDoc(doc(db, "users", currentUser.uid), { name: newName, bio: newBio }, { merge: true });

        const myUser = allUsers.find(u => u.uid === currentUser.uid);
        if (myUser) {
            myUser.name = newName;
            myUser.bio = newBio;
        }

        closeModals();
        loadProfile();
        renderHomeFeed();
        showToast("Profile Updated");
    } catch (e) {
        showToast("Profile update failed");
    }
    document.getElementById('global-loader').classList.add('hidden');
};

// ==========================================
// Upload Menu + Audio Mute/Resume
// ==========================================
window.openUploadMenu = () => {
    document.querySelectorAll('audio, video').forEach(media => {
        if (!media.paused) {
            media.pause();
            media.dataset.wasPlaying = 'true';
        }
    });
    document.querySelectorAll('.audio-toggle-btn').forEach(btn => {
        btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        btn.classList.remove('playing');
    });
    document.getElementById('upload-menu-modal').classList.remove('hidden');
};

window.resumeAllAudio = () => {
    document.querySelectorAll('audio, video').forEach(media => {
        if (media.dataset.wasPlaying === 'true') {
            media.play().catch(e => console.log(e));
            media.dataset.wasPlaying = 'false';
            if (media.id && media.id.startsWith('post-audio-')) {
                const btn = document.getElementById(media.id.replace('post-audio-', 'audio-btn-'));
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-volume-up"></i>';
                    btn.classList.add('playing');
                }
            }
        }
    });
};

window.closeModals = (e) => {
    if (!e || e.target.classList.contains('modal-overlay') || e.target.classList.contains('close-btn')) {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
        if (previewAudioObj) previewAudioObj.pause();
        const pvMedia = document.getElementById('pv-media');
        if (pvMedia) {
            const pvAudio = pvMedia.querySelector('audio');
            if (pvAudio) { pvAudio.pause(); pvAudio.currentTime = 0; }
            const pvVideo = pvMedia.querySelector('video');
            if (pvVideo) { pvVideo.pause(); pvVideo.currentTime = 0; }
        }
        if (typeof window.resumeAllAudio === 'function') window.resumeAllAudio();
    }
};

// ==========================================
// File Selection
// ==========================================
window.triggerFileSelect = (t) => {
    window.upType = t;
    document.getElementById('upload-menu-modal').classList.add('hidden');
    const fileInput = document.getElementById('mediaFile');
    fileInput.value = "";

    if (t === 'post') fileInput.accept = 'image/*';
    else fileInput.accept = 'image/*, video/*';

    setTimeout(() => fileInput.click(), 50);
};

window.triggerReelSelect = () => {
    window.upType = 'reel';
    document.getElementById('upload-menu-modal').classList.add('hidden');
    const fileInput = document.getElementById('mediaFile');
    fileInput.value = "";
    fileInput.accept = 'video/*';
    setTimeout(() => fileInput.click(), 50);
};

window.showPreviewModal = () => {
    selFile = document.getElementById("mediaFile").files[0];
    if (!selFile) return;

    if (window.upType === 'post' && selFile.type.startsWith('video/')) {
        showToast("Post শুধুমাত্র ফটো সাপোর্ট করে।");
        document.getElementById("mediaFile").value = "";
        selFile = null;
        return;
    }

    const titleMap = {
        'post': 'New Post',
        'story': 'New Story',
        'reel': 'New Reel'
    };
    document.getElementById('preview-title').innerText = titleMap[window.upType] || 'New Post';

    const u = URL.createObjectURL(selFile);
    document.getElementById('preview-container').innerHTML = selFile.type.startsWith('video/')
        ? `<video src="${u}" controls></video>`
        : `<img src="${u}">`;

    document.getElementById('upload-caption').style.display = (window.upType === 'post' || window.upType === 'reel') ? 'block' : 'none';
    document.getElementById('preview-modal').classList.remove('hidden');
};

// ==========================================
// Music Modal
// ==========================================
window.openMusicModal = async () => {
    const container = document.getElementById('music-list-container');
    container.innerHTML = '<p style="text-align:center; color:#8e8e8e; padding:20px;">Loading...</p>';
    try {
        const snap = await getDocs(query(collection(db, "admin_audio"), orderBy("timestamp", "desc")));
        let adminAudioHtml = '';
        if (!snap.empty) {
            adminAudioHtml += `<div style="padding: 8px 0; font-size: 12px; font-weight: 600; color: #0095f6; border-bottom: 1px solid #efefef; margin-bottom: 8px;"><i class="fas fa-crown"></i> Admin Uploaded</div>`;
            snap.forEach((docSnap) => {
                const audio = docSnap.data();
                adminAudioHtml += `<div class="music-item" onclick="selectMusic('${audio.url}', '${audio.name.replace(/'/g, "\\'")}')"><div class="music-info"><div class="music-icon" style="background: linear-gradient(45deg, #0095f6, #00c6ff);"><i class="fas fa-music"></i></div><div><div style="font-weight:600; font-size:14px;">${audio.name}</div><div style="font-size:12px; color:#8e8e8e;">${audio.artist}</div></div></div><i class="fas fa-play-circle" style="font-size:24px; color:#0095f6;"></i></div>`;
            });
        }
        let defaultHtml = `<div style="padding: 8px 0; font-size: 12px; font-weight: 600; color: #8e8e8e; border-bottom: 1px solid #efefef; margin-bottom: 8px; margin-top: 10px;"><i class="fas fa-globe"></i> Default Library</div>`;
        cloudMusicLibrary.forEach(m => {
            defaultHtml += `<div class="music-item" onclick="selectMusic('${m.url}', '${m.name}')"><div class="music-info"><div class="music-icon"><i class="fas fa-music"></i></div><div><div style="font-weight:600; font-size:14px;">${m.name}</div><div style="font-size:12px; color:#8e8e8e;">${m.artist}</div></div></div><i class="fas fa-play-circle" style="font-size:24px; color:#0095f6;"></i></div>`;
        });
        container.innerHTML = adminAudioHtml + defaultHtml;
    } catch (e) {
        console.error(e);
        let defaultHtml = '';
        cloudMusicLibrary.forEach(m => { defaultHtml += `<div class="music-item" onclick="selectMusic('${m.url}', '${m.name}')"><div class="music-info"><div class="music-icon"><i class="fas fa-music"></i></div><div><div style="font-weight:600; font-size:14px;">${m.name}</div><div style="font-size:12px; color:#8e8e8e;">${m.artist}</div></div></div><i class="fas fa-play-circle" style="font-size:24px; color:#0095f6;"></i></div>`; });
        container.innerHTML = defaultHtml;
    }
    document.getElementById('music-modal').classList.remove('hidden');
};

window.filterMusic = async (q) => {
    const queryStr = q.toLowerCase();
    const container = document.getElementById('music-list-container');
    container.innerHTML = '<p style="text-align:center; color:#8e8e8e; padding:10px;">Searching...</p>';
    try {
        const snap = await getDocs(collection(db, "admin_audio"));
        let html = '';
        snap.forEach((docSnap) => {
            const audio = docSnap.data();
            if (audio.name.toLowerCase().includes(queryStr) || audio.artist.toLowerCase().includes(queryStr)) {
                html += `<div class="music-item" onclick="selectMusic('${audio.url}', '${audio.name.replace(/'/g, "\\'")}')"><div class="music-info"><div class="music-icon" style="background: linear-gradient(45deg, #0095f6, #00c6ff);"><i class="fas fa-music"></i></div><div><div style="font-weight:600; font-size:14px;">${audio.name}</div><div style="font-size:12px; color:#8e8e8e;">${audio.artist}</div></div></div><i class="fas fa-play-circle" style="font-size:24px; color:#0095f6;"></i></div>`;
            }
        });
        cloudMusicLibrary.filter(m => m.name.toLowerCase().includes(queryStr) || m.artist.toLowerCase().includes(queryStr)).forEach(m => {
            html += `<div class="music-item" onclick="selectMusic('${m.url}', '${m.name}')"><div class="music-info"><div class="music-icon"><i class="fas fa-music"></i></div><div><div style="font-weight:600; font-size:14px;">${m.name}</div><div style="font-size:12px; color:#8e8e8e;">${m.artist}</div></div></div><i class="fas fa-play-circle" style="font-size:24px; color:#0095f6;"></i></div>`;
        });
        container.innerHTML = html || '<p style="text-align:center; color:#8e8e8e; padding:20px;">কোনো মিউজিক পাওয়া যায়নি।</p>';
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="text-align:center; color:#dc3545; padding:20px;">সার্চ করতে সমস্যা হয়েছে।</p>';
    }
};

window.handleLocalAudioUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('audio/')) return showToast("Please select a valid audio file.");
    selAudioFile = file;
    selMusicName = file.name;
    selMusicUrl = URL.createObjectURL(file);
    document.getElementById('selected-music-name').innerText = selMusicName;
    document.getElementById('selected-music-container').style.display = 'inline-flex';
    document.getElementById('music-modal').classList.add('hidden');
    if (previewAudioObj) previewAudioObj.pause();
    previewAudioObj = new Audio(selMusicUrl);
    previewAudioObj.play().catch(e => console.log(e));
    e.target.value = "";
};

window.selectMusic = (url, name) => {
    selMusicUrl = url;
    selMusicName = name;
    selAudioFile = null;
    document.getElementById('selected-music-name').innerText = name;
    document.getElementById('selected-music-container').style.display = 'inline-flex';
    document.getElementById('music-modal').classList.add('hidden');
    if (previewAudioObj) previewAudioObj.pause();
    previewAudioObj = new Audio(url);
    previewAudioObj.play().catch(e => console.log(e));
};

window.removeSelectedMusic = () => {
    selMusicUrl = null;
    selMusicName = "";
    selAudioFile = null;
    document.getElementById('selected-music-container').style.display = 'none';
    if (previewAudioObj) { previewAudioObj.pause(); previewAudioObj = null; }
};

// ==========================================
// Image Compression
// ==========================================
const compressImage = async (file) => {
    if (!file.type.startsWith('image/')) return file;
    return new Promise((res) => {
        const r = new FileReader();
        r.readAsDataURL(file);
        r.onload = ev => {
            const img = new Image();
            img.src = ev.target.result;
            img.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    const s = img.width > 1080 ? 1080 / img.width : 1;
                    c.width = img.width * s;
                    c.height = img.height * s;
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    c.toBlob(b => res(b ? new File([b], file.name, { type: 'image/jpeg' }) : file), 'image/jpeg', 0.8);
                } catch (err) { res(file); }
            };
            img.onerror = () => res(file);
        };
        r.onerror = () => res(file);
    });
};

// ==========================================
// Cloudinary Upload
// ==========================================
const uploadWithProgress = (file, configKey, onProgress) => {
    return new Promise((resolve, reject) => {
        const cfg = window.CLOUDINARY_CONFIG[configKey];
        if (!cfg) return reject(new Error('Invalid Cloudinary config: ' + configKey));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cfg.cloudName}/auto/upload`);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
            if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
            else reject(new Error('Upload failed'));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", cfg.uploadPreset);
        xhr.send(fd);
    });
};

// ==========================================
// Publish Media (Post / Story / Reel Dispatcher)
// ==========================================
window.publishMedia = async () => {
    if (!currentUser) return;

    if (window.upType === 'reel') {
        return handleReelPublish();
    }

    const file = selFile;
    if (!file) return;
    return handlePostStoryPublish(file);
};

// ================= POST & STORY =================
async function handlePostStoryPublish(file) {
    const uRef = doc(db, "users", currentUser.uid);
    const uSnap = await getDoc(uRef);
    let uData = uSnap.data();
    let isMember = uData.membershipStatus === 'active';

    if (window.upType === 'post') {
        const todayStr = new Date().toDateString();
        let todaysPostCount = 0;
        allPosts.forEach(p => {
            if (p.uid === currentUser.uid && p.timestamp) {
                let postDateStr = p.timestamp.toMillis
                    ? new Date(p.timestamp.toMillis()).toDateString()
                    : new Date(p.timestamp).toDateString();
                if (postDateStr === todayStr) todaysPostCount++;
            }
        });
        let dailyLimit = isMember ? 3 : 1;
        if (todaysPostCount >= dailyLimit) {
            showToast(`⚠️ আপনি একদিনে সর্বোচ্চ ${dailyLimit} টি পোস্ট করতে পারবেন!`);
            document.getElementById('preview-modal').classList.add('hidden');
            document.getElementById("mediaFile").value = "";
            selFile = null;
            return;
        }
    }

    if (previewAudioObj) { previewAudioObj.pause(); previewAudioObj = null; }
    document.getElementById('preview-modal').classList.add('hidden');

    const overlay = document.getElementById('upload-progress-overlay');
    const bar = document.getElementById('upload-progress-bar');
    const txt = document.getElementById('upload-progress-text');
    const stat = document.getElementById('progress-status-text');

    overlay.classList.remove('hidden');
    stat.innerText = "Compressing Media...";
    bar.style.width = "0%";
    txt.innerText = "0%";

    let finalMusicUrl = selMusicUrl;
    let finalMusicName = selMusicName;

    try {
        const compFile = await compressImage(file);
        stat.innerText = "Uploading Media...";

        const data = await uploadWithProgress(compFile, "postStory", (pct) => {
            let p = selAudioFile ? pct / 2 : pct;
            bar.style.width = p + "%";
            txt.innerText = Math.round(p) + "%";
        });

        if (selAudioFile) {
            stat.innerText = "Uploading Custom Audio...";
            const audioData = await uploadWithProgress(selAudioFile, "postStory", (pct) => {
                let p = 50 + (pct / 2);
                bar.style.width = p + "%";
                txt.innerText = Math.round(p) + "%";
            });
            finalMusicUrl = audioData.secure_url;
        }

        stat.innerText = "Saving Data...";
        const newMediaDoc = {
            uid: currentUser.uid,
            mediaUrl: data.secure_url,
            caption: document.getElementById('upload-caption').value,
            timestamp: serverTimestamp(),
            views: 0,
            ...(finalMusicUrl && { musicUrl: finalMusicUrl, musicName: finalMusicName }),
            ...(window.upType === 'story' && {
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                viewers: [], likes: [], comments: []
            })
        };

        const docRef = await addDoc(collection(db, window.upType === 'post' ? 'posts' : 'stories'), newMediaDoc);

        if (window.upType === 'post') {
            allPosts.unshift({ id: docRef.id, ...newMediaDoc, timestamp: Date.now() });
            renderHomeFeed();
        }

        let wBal = uData.walletBalance || 0;

        if (window.upType === 'post') {
            let pCount = (uData.postCount || 0) + 1;
            let earned = 0;
            if (isMember) {
                if (pCount === 1) earned = 2;
                else if (pCount === 10) earned = 23;
                else if (pCount === 50) earned = 125;
                else if (pCount === 100) earned = 150;
                else if (pCount === 150) earned = 100;
            }
            if (earned > 0) {
                wBal += earned;
                await updateDoc(uRef, { postCount: pCount, walletBalance: wBal });
                showToast(`Post Published! Milestone Bonus: ₹${earned} Added!`);
            } else {
                await updateDoc(uRef, { postCount: pCount });
                if (!isMember) showToast("Post Published! (Membership required to earn)");
                else showToast("Post Published!");
            }
        } else if (window.upType === 'story') {
            const now = Date.now();
            const lastPaidTime = uData.lastPaidStoryTime || 0;
            if (now - lastPaidTime >= 24 * 60 * 60 * 1000) {
                let earned = isMember ? 3 : 0;
                if (earned > 0) {
                    wBal += earned;
                    await updateDoc(uRef, { walletBalance: wBal, lastPaidStoryTime: now });
                    showToast(`Story Uploaded! Earned ₹${earned}`);
                } else {
                    await updateDoc(uRef, { lastPaidStoryTime: now });
                    showToast("Story Uploaded! (Membership required to earn)");
                }
            } else {
                showToast("Story Uploaded Successfully!");
            }
        }
    } catch (e) {
        console.error(e);
        showToast("Upload failed.");
    }

    overlay.classList.add('hidden');
    selFile = null;
    document.getElementById("mediaFile").value = "";
    document.getElementById('upload-caption').value = "";
    removeSelectedMusic();
    window.upType = '';
}

// ================= REEL PUBLISH =================
async function handleReelPublish() {
    const fileInput = document.getElementById("mediaFile");
    const file = fileInput.files[0];
    if (!file || !currentUser) return;

    document.getElementById('preview-modal').classList.add('hidden');

    const uSnap = await getDoc(doc(db, "users", currentUser.uid));
    const isMember = uSnap.data().membershipStatus === 'active';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(collection(db, "reels"), where("uid", "==", currentUser.uid));
    const snap = await getDocs(q);
    let todayCount = 0;
    snap.forEach(d => {
        const rDate = d.data().timestamp ? d.data().timestamp.toMillis() : 0;
        if (rDate > today.getTime()) todayCount++;
    });

    let limit = isMember ? 3 : 1;
    if (todayCount >= limit) {
        showToast(`⚠️ আপনি একদিনে সর্বোচ্চ ${limit} টি রিল আপলোড করতে পারবেন!`);
        fileInput.value = "";
        window.upType = '';
        return;
    }

    const overlay = document.getElementById('upload-progress-overlay');
    overlay.classList.remove('hidden');
    document.getElementById('progress-status-text').innerText = "Uploading Reel...";
    document.getElementById('upload-progress-bar').style.width = "0%";
    document.getElementById('upload-progress-text').innerText = "0%";

    try {
        const cfg = window.CLOUDINARY_CONFIG.reel;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", cfg.uploadPreset);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cfg.cloudName}/auto/upload`);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                let pct = Math.round((e.loaded / e.total) * 100);
                document.getElementById('upload-progress-bar').style.width = pct + "%";
                document.getElementById('upload-progress-text').innerText = pct + "%";
            }
        };
        xhr.onload = async () => {
            if (xhr.status === 200) {
                const res = JSON.parse(xhr.responseText);
                await addDoc(collection(db, "reels"), {
                    uid: currentUser.uid,
                    mediaUrl: res.secure_url,
                    caption: document.getElementById('upload-caption').value,
                    timestamp: serverTimestamp(),
                    likes: [], comments: []
                });
                showToast("Reel Published Successfully!");
                overlay.classList.add('hidden');
                fileInput.value = "";
                document.getElementById('upload-caption').value = "";
                window.upType = '';
                window.allReelsGlobal = [];
                if (document.getElementById('reels-page').classList.contains('active')) {
                    window.loadReels();
                }
            } else {
                showToast("Reel Upload failed");
                overlay.classList.add('hidden');
                window.upType = '';
            }
        };
        xhr.send(fd);
    } catch (e) {
        console.error(e);
        showToast("Error uploading Reel");
        overlay.classList.add('hidden');
        window.upType = '';
    }
}

// ==========================================
// Upload Avatar
// ==========================================
window.uploadNewAvatar = async () => {
    const file = document.getElementById("avatarUpload").files[0];
    if (!file) return;
    const overlay = document.getElementById('upload-progress-overlay');
    const bar = document.getElementById('upload-progress-bar');
    const txt = document.getElementById('upload-progress-text');
    const stat = document.getElementById('progress-status-text');

    overlay.classList.remove('hidden');
    stat.innerText = "Processing Photo...";
    bar.style.width = "0%";
    txt.innerText = "0%";

    try {
        const comp = await compressImage(file);
        stat.innerText = "Uploading...";
        const data = await uploadWithProgress(comp, "postStory", (pct) => { bar.style.width = pct + "%"; txt.innerText = pct + "%"; });
        stat.innerText = "Updating Profile...";

        await setDoc(doc(db, "users", currentUser.uid), { avatar: data.secure_url }, { merge: true });

        const myUser = allUsers.find(u => u.uid === currentUser.uid);
        if (myUser) myUser.avatar = data.secure_url;

        document.getElementById("profile-page-avatar").src = data.secure_url;
        renderHomeFeed();
        showToast("Profile Photo Updated!");
    } catch (e) { showToast("Failed to update avatar."); }

    overlay.classList.add('hidden');
    document.getElementById("avatarUpload").value = "";
};

// ==========================================
// Share
// ==========================================
window.openShareModal = (mediaId, type = 'post') => {
    postToShare = mediaId;
    shareMediaType = type;
    document.getElementById('shareSearchInput').value = '';
    renderShareList();
    document.getElementById('share-modal').classList.remove('hidden');
};

window.renderShareList = () => {
    const q = document.getElementById("shareSearchInput").value.toLowerCase();
    const l = document.getElementById("share-users-list");
    l.innerHTML = '';
    let f = allUsers.filter(u => u.uid !== currentUser.uid);
    if (q) f = f.filter(u => (u.name || '').toLowerCase().includes(q));
    f.forEach(u => {
        const d = document.createElement('div');
        d.className = 'share-user-item';
        d.innerHTML = `<div class="share-user-info"><img src="${u.avatar}"> <span>${u.name}</span></div><button class="send-btn" id="send-btn-${u.uid}" onclick="sendSharedPost('${u.uid}')">Send</button>`;
        l.appendChild(d);
    });
};

window.sendSharedPost = async (tUid) => {
    if (!postToShare) return;
    const b = document.getElementById(`send-btn-${tUid}`);
    if (b) { b.innerText = "Sent"; b.classList.add("sent"); b.disabled = true; }
    const cId = currentUser.uid < tUid ? currentUser.uid + '_' + tUid : tUid + '_' + currentUser.uid;
    await addDoc(collection(db, `chats/${cId}/messages`), {
        sender: currentUser.uid,
        postId: postToShare,
        mediaType: shareMediaType,
        timestamp: Date.now()
    });
};
// ==========================================
// Messages & Chat
// ==========================================
const getChatId = (u1, u2) => u1 < u2 ? u1 + '_' + u2 : u2 + '_' + u1;

window.renderMessagesList = () => {
    const l = document.getElementById('messages-user-list');
    l.innerHTML = '';
    const q = (document.getElementById("messageSearch") ? document.getElementById("messageSearch").value.toLowerCase() : '');
    let f = allUsers.filter(u => u.uid !== currentUser.uid);
    if (q) f = f.filter(u => (u.name || '').toLowerCase().includes(q));
    f.forEach(u => {
        const d = document.createElement('div');
        d.className = 'list-item';
        d.onclick = () => openChat(u.uid);
        d.innerHTML = `<img src="${u.avatar}"> <div class="list-item-content"><strong>${u.name}</strong><span>Tap to chat</span></div>`;
        l.appendChild(d);
    });
};

window.searchMessageUsers = () => renderMessagesList();

window.openChat = (uid) => {
    actChatU = uid;
    const u = allUsers.find(usr => usr.uid === uid);
    document.getElementById('chat-user-name').innerText = u.name;
    document.getElementById('chat-user-avatar').src = u.avatar;
    navigateTo('chat');

    if (chatUnsub) chatUnsub();
    const cId = getChatId(currentUser.uid, uid);
    chatUnsub = onSnapshot(query(collection(db, `chats/${cId}/messages`), orderBy("timestamp", "asc")), (snap) => {
        const a = document.getElementById('chat-messages-area');
        a.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            const isMe = m.sender === currentUser.uid;
            const d = document.createElement('div');
            d.className = `chat-bubble ${isMe ? 'sent' : 'received'}`;

            if (m.postId) {
                let p = allPosts.find(pt => pt.id === m.postId);
                if (!p && window.allReelsGlobal) p = window.allReelsGlobal.find(pt => pt.id === m.postId);

                if (p) {
                    let isVideo = p.mediaUrl.match(/\.(mp4|webm|mov)$/i);
                    d.innerHTML = `<div style="font-size:12px; margin-bottom:5px;">Shared a ${m.mediaType || 'post'}</div>
                                   <div class="chat-shared-post" onclick="closeModals(null); ${m.mediaType === 'reel' ? `window.navigateTo('reels')` : `openPostViewer('${p.id}')`}">
                                       ${isVideo ? `<video src="${p.mediaUrl}" muted style="width:100%; border-radius:10px;"></video>` : `<img src="${p.mediaUrl}" style="width:100%; border-radius:10px;">`}
                                   </div>`;
                } else {
                    d.innerHTML = '<i>Media unavailable</i>';
                }
            } else {
                d.innerText = m.text;
            }

            a.appendChild(d);
        });
        a.scrollTop = a.scrollHeight;
    });
};

window.sendChatMessage = async () => {
    const i = document.getElementById('chat-input');
    const t = i.value.trim();
    if (!t || !actChatU) return;
    const cId = getChatId(currentUser.uid, actChatU);
    await addDoc(collection(db, `chats/${cId}/messages`), { sender: currentUser.uid, text: t, timestamp: Date.now() });
    i.value = '';
};

// ==========================================
// Story Viewer
// ==========================================
window.startStoryViewer = (uid, isSelf) => {
    document.querySelectorAll('audio[id^="post-audio-"]').forEach(a => {
        a.pause();
        const btnElem = document.getElementById(a.id.replace('post-audio-', 'audio-btn-'));
        if (btnElem) { btnElem.innerHTML = '<i class="fas fa-volume-mute"></i>'; btnElem.classList.remove('playing'); }
    });
    actStoryU = uid;
    isMySt = isSelf;
    actStoryIdx = 0;
    actStArr = isSelf ? myActiveStories : groupedStories[uid];
    if (!actStArr || actStArr.length === 0) return;
    renderStoryMedia();
    document.getElementById('story-viewer').classList.remove('hidden');
    activeStoryUser = uid;
};

window.renderStoryMedia = () => {
    const s = actStArr[actStoryIdx];
    const u = allUsers.find(usr => usr.uid === actStoryU) || { name: 'User', avatar: '' };
    document.getElementById('viewer-user-name').innerText = u.name;
    document.getElementById('viewer-user-avatar').src = u.avatar;

    let optimizedUrl = s.mediaUrl;
    if (optimizedUrl.includes('cloudinary.com')) {
        optimizedUrl = optimizedUrl.replace('/upload/', '/upload/q_auto,f_auto/');
    }

    const mediaContainer = document.getElementById('story-media-container');
    let videoMuted = s.musicUrl ? 'muted' : '';
    let storyAudioHtml = s.musicUrl ? `<audio id="current-story-audio" src="${s.musicUrl}" autoplay></audio>` : '';

    mediaContainer.innerHTML = `
        ${storyAudioHtml}
        ${s.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? `<video id="current-story-video" src="${optimizedUrl}" autoplay playsinline ${videoMuted} style="max-width: 100%; max-height: 100vh; object-fit: contain; animation: storyFadeIn 0.3s ease-in-out;"></video>` : `<img id="current-story-img" src="${optimizedUrl}" style="animation: storyFadeIn 0.3s ease-in-out;">`}
        <div class="tap-zone left"></div><div class="tap-zone right"></div>
    `;

    let lastTap = 0;
    mediaContainer.onclick = (e) => {
        if (e.target.closest('.story-bottom-bar')) return;
        const now = Date.now();
        if (now - lastTap < 300) {
            const isL = s.likes && s.likes.includes(currentUser.uid);
            window.toggleStoryLike(s.id, isL);
            const r = mediaContainer.getBoundingClientRect();
            const h = document.createElement('div');
            h.className = 'like-animation';
            h.innerHTML = `<svg width="80" height="80" viewBox="0 0 24 24" fill="#ed4956" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
            h.style.left = (e.clientX - r.left) + 'px';
            h.style.top = (e.clientY - r.top) + 'px';
            mediaContainer.appendChild(h);
            setTimeout(() => h.remove(), 600);
        } else {
            if (e.clientX < window.innerWidth / 2) window.prevStory();
            else window.nextStory();
        }
        lastTap = now;
    };

    viewedStories[s.id] = true;
    if (!isMySt && s.id) {
        if (!s.viewers) s.viewers = [];
        if (!s.viewers.includes(currentUser.uid)) updateDoc(doc(db, "stories", s.id), { viewers: arrayUnion(currentUser.uid) });
    }

    const b = document.getElementById('story-bottom-bar');
    if (isMySt) {
        b.innerHTML = `<div style="color:#fff; display:flex; align-items:center; gap:5px; cursor:pointer;" onclick="openStoryAnalytics('${s.id}')"><i class="fa-regular fa-eye" style="font-size:20px;"></i> <span>${s.viewers ? s.viewers.length : 0} Views</span></div><i class="fa-regular fa-trash-can" style="color:#fff; font-size:20px; cursor:pointer;" onclick="askDeleteStory('${s.id}')"></i>`;
    } else {
        const isL = s.likes && s.likes.includes(currentUser.uid);
        b.innerHTML = `<input type="text" class="story-reply-input" placeholder="Reply..." onkeypress="handleStoryReply(event, '${s.id}')"><button style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer;" onclick="window.toggleStoryLike('${s.id}', ${isL})"><i class="${isL ? 'fa-solid liked' : 'fa-regular'} fa-heart" style="${isL ? 'color:#ed4956;' : ''}"></i></button>`;
    }

    const pC = document.getElementById('story-progress-container');
    pC.innerHTML = '';
    for (let i = 0; i < actStArr.length; i++) {
        pC.innerHTML += `<div class="story-progress-bar"><div class="story-progress-fill" id="fill-${i}" style="width:${i < actStoryIdx ? '100%' : '0%'};"></div></div>`;
    }

    setTimeout(() => {
        if (document.getElementById(`fill-${actStoryIdx}`)) {
            const len = (document.getElementById('current-story-video') || document.getElementById('current-story-audio')) ? 15 : 5;
            document.getElementById(`fill-${actStoryIdx}`).style.transition = `width ${len}s linear`;
            document.getElementById(`fill-${actStoryIdx}`).style.width = '100%';
        }
    }, 50);

    clearTimeout(stTime);
    const vid = document.getElementById('current-story-video');
    const aud = document.getElementById('current-story-audio');
    if (vid) vid.onended = window.nextStory;
    else if (aud) aud.onended = window.nextStory;
    else stTime = setTimeout(() => window.nextStory(), 5000);
};

window.nextStory = () => {
    if (actStoryIdx < actStArr.length - 1) {
        actStoryIdx++;
        renderStoryMedia();
    } else {
        if (!isMySt) {
            const sortedUsers = Object.keys(groupedStories);
            const currentIdx = sortedUsers.indexOf(actStoryU);
            if (currentIdx !== -1 && currentIdx < sortedUsers.length - 1) {
                for (let i = currentIdx + 1; i < sortedUsers.length; i++) {
                    const nextUser = sortedUsers[i];
                    const hasUnviewed = groupedStories[nextUser].some(s => !hasViewedStory(s.id));
                    if (hasUnviewed) {
                        startStoryViewer(nextUser, false);
                        return;
                    }
                }
            }
        }
        window.closeStoryViewer();
        renderStoryBar();
    }
};

window.prevStory = () => {
    if (actStoryIdx > 0) {
        actStoryIdx--;
        renderStoryMedia();
    } else renderStoryMedia();
};

window.closeStoryViewer = () => {
    clearTimeout(stTime);
    const a = document.getElementById('current-story-audio');
    if (a) { a.pause(); a.currentTime = 0; }
    document.getElementById('story-viewer').classList.add('hidden');
    document.getElementById('story-media-container').innerHTML = '';
    renderStoryBar();
};

const storyViewerObj = document.getElementById('story-viewer');
storyViewerObj.addEventListener('touchstart', (e) => touchstartX = e.changedTouches[0].screenX, false);
storyViewerObj.addEventListener('touchend', (e) => {
    touchendX = e.changedTouches[0].screenX;
    if (touchendX < touchstartX - 60) window.nextStory();
    if (touchendX > touchstartX + 60) window.prevStory();
}, false);

window.toggleStoryLike = async (id, isL) => {
    if (isL) await updateDoc(doc(db, "stories", id), { likes: arrayRemove(currentUser.uid) });
    else await updateDoc(doc(db, "stories", id), { likes: arrayUnion(currentUser.uid) });
};

window.handleStoryReply = async (e, id) => {
    if (e.key === 'Enter') {
        const t = e.target.value.trim();
        if (t) {
            const cId = getChatId(currentUser.uid, actStoryU);
            await addDoc(collection(db, `chats/${cId}/messages`), { sender: currentUser.uid, text: `[Story Reply]: ${t}`, timestamp: Date.now() });
            e.target.value = '';
            showToast("Sent in DM!");
        }
    }
};

window.openStoryAnalytics = (id) => {
    clearTimeout(stTime);
    const s = myActiveStories.find(st => st.id === id);
    const l = document.getElementById('viewers-list');
    l.innerHTML = '';
    if (s && s.viewers && s.viewers.length > 0) {
        s.viewers.forEach(uid => {
            const u = allUsers.find(usr => usr.uid === uid) || { name: 'User', avatar: 'https://picsum.photos/100' };
            l.innerHTML += `<div class="viewer-item" onclick="closeModals(null); window.closeStoryViewer(); viewProfile('${uid}')"><img src="${u.avatar}"><span>${u.name}</span></div>`;
        });
    } else {
        l.innerHTML = '<p style="text-align:center; color:#8e8e8e;">No views yet.</p>';
    }
    document.getElementById('story-viewers-modal').classList.remove('hidden');
};

// ==========================================
// Admin Panel
// ==========================================
window.showAdminSection = (sec) => {
    document.querySelectorAll('.admin-sec').forEach(el => el.style.display = 'none');
    document.querySelectorAll('#admin-panel-page .action-btn').forEach(btn => btn.classList.remove('primary'));
    document.getElementById('admin-sec-' + sec).style.display = 'block';
    document.getElementById('btn-admin-' + sec).classList.add('primary');
};

window.loadAdminPanel = async () => {
    const list = document.getElementById('admin-user-list');
    const vList = document.getElementById('admin-verification-list');
    const mList = document.getElementById('admin-membership-list');
    if (!list || !vList || !mList) return;

    list.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';
    vList.innerHTML = '';
    mList.innerHTML = '';

    const querySnapshot = await getDocs(collection(db, "users"));
    list.innerHTML = '';

    querySnapshot.forEach((docSnap) => {
        const u = docSnap.data();
        const uid = docSnap.id;
        const isBlocked = u.isBlocked || false;

        const div = document.createElement('div');
        div.className = 'list-item';
        div.style.border = '1px solid #dbdbdb';
        div.style.marginBottom = '10px';
        div.style.borderRadius = '10px';

        const verifyBtnHtml = u.verificationStatus === 'verified'
            ? `<button class="action-btn" style="background:#dc3545; color:#fff; padding:5px 10px; font-size:11px;" onclick="window.handleVerification('${uid}', 'none')">Remove Badge</button>`
            : '';

        div.innerHTML = `
            <img src="${u.avatar || 'https://picsum.photos/100'}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
            <div class="list-item-content" style="flex:1;">
                <strong>${u.name || 'Unknown'} ${u.verificationStatus === 'verified' ? ' <i class="fa-solid fa-circle-check" style="color:#0095f6; font-size:12px;"></i>' : ''}</strong>
                <span style="font-size:11px;">${u.email || 'No Email'}</span>
                <span style="color:${isBlocked ? 'red' : 'green'}; font-weight:bold;">${isBlocked ? 'BLOCKED' : 'ACTIVE'}</span>
            </div>
            <div style="display:flex; gap:5px; flex-wrap:wrap;">
                <button class="action-btn" style="background:${isBlocked ? '#28a745' : '#ffc107'}; color:#fff; padding:5px 10px; font-size:11px;" onclick="window.toggleBlockUser('${uid}', ${isBlocked})">
                    ${isBlocked ? 'Unblock' : 'Block'}
                </button>
                ${verifyBtnHtml}
            </div>
        `;
        list.appendChild(div);

        if (u.verificationStatus === 'pending') {
            const vDiv = document.createElement('div');
            vDiv.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #efefef;';
            vDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${u.avatar || 'https://picsum.photos/100'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    <div><strong style="font-size:13px;">${u.name}</strong><br><span style="font-size:11px; color:#8e8e8e;">Followers: ${(u.followers || []).length}</span></div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="window.handleVerification('${uid}', 'verified')" style="background:#28a745; color:white; border:none; padding:5px 10px; border-radius:5px; font-size:12px; cursor:pointer;"><i class="fa-solid fa-check"></i></button>
                    <button onclick="window.handleVerification('${uid}', 'rejected')" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:5px; font-size:12px; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
            vList.appendChild(vDiv);
        }

        if (u.membershipRequest === 'pending') {
            const mDiv = document.createElement('div');
            mDiv.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #efefef;';
            mDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${u.avatar || 'https://picsum.photos/100'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    <div>
                        <strong style="font-size:13px;">${u.name}</strong><br>
                        <span style="font-size:11px; color:#8e8e8e;">Txn ID: ${u.paymentTxnId || 'N/A'} (Days: ${u.requestedMembershipDays || 30})</span>
                    </div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="window.handleMembership('${uid}', 'active')" style="background:#28a745; color:white; border:none; padding:5px 10px; border-radius:5px; font-size:12px; cursor:pointer;">Accept</button>
                    <button onclick="window.handleMembership('${uid}', 'rejected')" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:5px; font-size:12px; cursor:pointer;">Reject</button>
                </div>
            `;
            mList.appendChild(mDiv);
        }
    });
    if (vList.innerHTML === '') vList.innerHTML = '<p style="font-size:12px; color:#8e8e8e; padding:10px;">No pending verification requests.</p>';
    if (mList.innerHTML === '') mList.innerHTML = '<p style="font-size:12px; color:#8e8e8e; padding:10px;">No pending membership requests.</p>';

    setTimeout(() => { window.loadAdminAudioList(); }, 500);
};

window.handleVerification = async (uid, status) => {
    const updateData = { verificationStatus: status };
    if (status === 'rejected') updateData.verificationLastRejected = serverTimestamp();
    await updateDoc(doc(db, "users", uid), updateData);

    const u = allUsers.find(x => x.uid === uid);
    if (u) u.verificationStatus = status;

    showToast(status === 'none' ? 'Badge Removed' : `Verification ${status}`);
    window.loadAdminPanel();
};

window.toggleBlockUser = async (uid, currentStatus) => {
    await updateDoc(doc(db, "users", uid), { isBlocked: !currentStatus });
    const u = allUsers.find(x => x.uid === uid);
    if (u) u.isBlocked = !currentStatus;
    showToast(currentStatus ? "User Unblocked" : "User Blocked");
    window.loadAdminPanel();
};

// ==========================================
// Admin Audio Library
// ==========================================
window.uploadAdminAudio = async () => {
    const artistInput = document.getElementById('admin-audio-artist');
    const fileInput = document.getElementById('admin-audio-file');

    const artist = artistInput.value.trim() || 'Unknown Artist';
    const files = fileInput.files;

    if (files.length === 0) return showToast('অনুগ্রহ করে অন্তত একটি অডিও ফাইল নির্বাচন করুন');

    const overlay = document.getElementById('upload-progress-overlay');
    const bar = document.getElementById('upload-progress-bar');
    const txt = document.getElementById('upload-progress-text');
    const stat = document.getElementById('progress-status-text');

    overlay.classList.remove('hidden');
    stat.innerText = `Uploading ${files.length} Audio(s)...`;
    bar.style.width = "0%";
    txt.innerText = "0%";

    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        if (!file.type.startsWith('audio/')) continue;

        let fileName = file.name.replace(/\.[^/.]+$/, "");

        try {
            const data = await uploadWithProgress(file, "postStory", (pct) => {
                let overallPct = Math.round(((i * 100) + pct) / files.length);
                bar.style.width = overallPct + "%";
                txt.innerText = overallPct + "%";
            });
            await addDoc(collection(db, "admin_audio"), { name: fileName, artist: artist, url: data.secure_url, uploadedBy: currentUser.uid, timestamp: serverTimestamp() });
            successCount++;
        } catch (e) { console.error("Failed to upload " + fileName); }
    }

    overlay.classList.add('hidden');
    if (successCount > 0) {
        showToast(`✅ ${successCount} টি অডিও সফলভাবে আপলোড হয়েছে!`);
        artistInput.value = '';
        fileInput.value = '';
        window.loadAdminAudioList();
    } else {
        showToast('❌ আপলোড ব্যর্থ হয়েছে');
    }
};

window.loadAdminAudioList = async () => {
    const listContainer = document.getElementById('admin-audio-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<p style="font-size: 12px; color: #8e8e8e;">Loading...</p>';
    try {
        const snap = await getDocs(query(collection(db, "admin_audio"), orderBy("timestamp", "desc")));
        listContainer.innerHTML = '';
        if (snap.empty) {
            listContainer.innerHTML = '<p style="font-size: 12px; color: #8e8e8e; text-align: center;">কোনো অডিও আপলোড করা হয়নি।</p>';
            return;
        }
        snap.forEach((docSnap) => {
            const audio = docSnap.data();
            const audioId = docSnap.id;
            const div = document.createElement('div');
            div.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid #efefef; gap: 10px;`;
            div.innerHTML = `
                <input type="checkbox" class="admin-audio-checkbox" value="${audioId}" style="width:16px; height:16px; flex-shrink:0;">
                <div style="flex: 1; overflow: hidden;"><div style="font-size: 13px; font-weight: 600; color: #262626; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${audio.name}</div><div style="font-size: 11px; color: #8e8e8e;">${audio.artist}</div></div>
                <audio src="${audio.url}" controls style="height: 30px; width: 120px; flex-shrink:0;"></audio>
                <button onclick="window.deleteAdminAudio('${audioId}')" style="background: #dc3545; color: #fff; border: none; border-radius: 6px; padding: 5px 10px; font-size: 11px; cursor: pointer; flex-shrink:0;"><i class="fas fa-trash"></i></button>`;
            listContainer.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        listContainer.innerHTML = '<p style="font-size: 12px; color: #dc3545;">লোড করতে সমস্যা হয়েছে।</p>';
    }
};

window.deleteAdminAudio = (audioId) => {
    window.openProConfirm("এই অডিওটি ডিলিট করতে চান?", async () => {
        try {
            await deleteDoc(doc(db, "admin_audio", audioId));
            showToast('🗑️ অডিও ডিলিট হয়েছে');
            window.loadAdminAudioList();
        } catch (e) { showToast('ডিলিট করতে সমস্যা হয়েছে'); }
    });
};

window.toggleSelectAllAudios = (checkbox) => {
    document.querySelectorAll('.admin-audio-checkbox').forEach(cb => cb.checked = checkbox.checked);
};

window.deleteSelectedAudios = () => {
    const selected = Array.from(document.querySelectorAll('.admin-audio-checkbox:checked')).map(cb => cb.value);
    if (selected.length === 0) return showToast("অন্তত একটি অডিও সিলেক্ট করুন!");

    window.openProConfirm(`${selected.length} টি অডিও ডিলিট করতে চান?`, async () => {
        document.getElementById('global-loader').classList.remove('hidden');
        document.getElementById('loader-text').innerText = "Deleting...";
        try {
            for (let id of selected) {
                await deleteDoc(doc(db, "admin_audio", id));
            }
            showToast(`🗑️ ${selected.length} টি অডিও ডিলিট হয়েছে`);
            document.getElementById('selectAllAudios').checked = false;
            window.loadAdminAudioList();
        } catch (e) { showToast('ডিলিট করতে সমস্যা হয়েছে'); }
        document.getElementById('global-loader').classList.add('hidden');
    });
};

window.randomlyReplaceAllPostSongs = async () => {
    window.openProConfirm("অ্যাপের সমস্ত পোস্টের গান রেনডমলি পরিবর্তন করতে চান?", async () => {
        document.getElementById('global-loader').classList.remove('hidden');
        document.getElementById('loader-text').innerText = "Fetching Audio Library...";
        try {
            const audioSnap = await getDocs(collection(db, "admin_audio"));
            if (audioSnap.empty) {
                document.getElementById('global-loader').classList.add('hidden');
                return showToast("অ্যাডমিন প্যানেলে কোনো গান নেই! আগে গান আপলোড করুন।");
            }

            const adminAudios = [];
            audioSnap.forEach(doc => adminAudios.push(doc.data()));

            document.getElementById('loader-text').innerText = "Replacing Songs...";

            const postSnap = await getDocs(collection(db, "posts"));
            const updatePromises = [];

            postSnap.forEach(postDoc => {
                const randomAudio = adminAudios[Math.floor(Math.random() * adminAudios.length)];
                const updatePromise = updateDoc(doc(db, "posts", postDoc.id), {
                    musicUrl: randomAudio.url,
                    musicName: randomAudio.name
                });
                updatePromises.push(updatePromise);

                const pIdx = allPosts.findIndex(p => p.id === postDoc.id);
                if (pIdx !== -1) {
                    allPosts[pIdx].musicUrl = randomAudio.url;
                    allPosts[pIdx].musicName = randomAudio.name;
                }
            });

            await Promise.all(updatePromises);

            showToast(`✅ ${updatePromises.length} টি পোস্টের গান পরিবর্তন হয়েছে!`);
            renderHomeFeed();
        } catch (e) {
            console.error(e);
            showToast("গান রিপ্লেস করতে সমস্যা হয়েছে!");
        }
        document.getElementById('global-loader').classList.add('hidden');
    });
};

// ==========================================
// Creator Hub
// ==========================================
window.loadCreatorHub = async () => {
    try {
        const uRef = doc(db, "users", currentUser.uid);
        const uSnap = await getDoc(uRef);
        let uData = uSnap.data();

        document.getElementById('creator-wallet-bal').innerText = `₹${uData.walletBalance || 0}`;
        document.getElementById('post-progress-text').innerText = `Your Total Posts: ${uData.postCount || 0}`;
    } catch (e) { console.log(e); }
};

window.withdrawToZuuPay = async () => {
    document.getElementById('global-loader').classList.remove('hidden');

    try {
        const uRef = doc(db, "users", currentUser.uid);
        const uSnap = await getDoc(uRef);
        let uData = uSnap.data();

        if (uData.membershipStatus !== 'active') {
            document.getElementById('global-loader').classList.add('hidden');
            return showToast("টাকা তোলার জন্য আপনার অ্যাক্টিভ মেম্বারশিপ থাকতে হবে!");
        }

        let bal = uData.walletBalance || 0;
        if (bal <= 0) {
            document.getElementById('global-loader').classList.add('hidden');
            return showToast("উইথড্র করার জন্য পর্যাপ্ত ব্যালেন্স নেই");
        }

        const zuuid = document.getElementById('withdraw-zuuid').value.trim();
        if (!zuuid || zuuid.length < 5) {
            document.getElementById('global-loader').classList.add('hidden');
            return showToast("দয়া করে সঠিক Zuu Pay ID দিন");
        }

        const q = query(collection(zuuDb, "users"), where("zuuId", "==", zuuid));
        const zuuSnap = await getDocs(q);

        if (zuuSnap.empty) {
            document.getElementById('global-loader').classList.add('hidden');
            return showToast("এই Zuu Pay ID টি ভুল বা খুঁজে পাওয়া যায়নি!");
        }

        const zuuUserDoc = zuuSnap.docs[0];
        const zuuUserData = zuuUserDoc.data();

        await updateDoc(uRef, { walletBalance: 0 });
        await updateDoc(doc(zuuDb, "users", zuuUserDoc.id), { balance: (zuuUserData.balance || 0) + bal });
        await addDoc(collection(zuuDb, "transactions"), {
            senderUid: "insta_story_earn",
            senderName: "Insta Story (Earn App)",
            receiverUid: zuuUserData.uid,
            receiverName: zuuUserData.name,
            amount: bal,
            timestamp: serverTimestamp(),
            type: 'transfer'
        });

        showToast(`₹${bal} আপনার Zuu Pay একাউন্টে সফলভাবে যোগ হয়েছে!`);
        document.getElementById('withdraw-zuuid').value = '';
        document.getElementById('creator-wallet-bal').innerText = "₹0";

    } catch (e) { showToast("উইথড্র ফেইল হয়েছে। আবার চেষ্টা করুন।"); }
    document.getElementById('global-loader').classList.add('hidden');
};

// ==========================================
// Membership / Payment
// ==========================================
setTimeout(() => {
    const menuModal = document.getElementById('profile-menu-modal');
    if (menuModal) {
        const content = menuModal.querySelector('.modal-content');

        const oldBtns = content.querySelectorAll('button');
        oldBtns.forEach(btn => {
            if (btn.innerText.includes('Buy Membership') || btn.innerText.includes('Membership - ₹')) btn.remove();
        });

        const plans = [
            { price: 99, days: 30, text: '30 Days' },
            { price: 35, days: 10, text: '10 Days' },
            { price: 25, days: 7, text: '7 Days' },
            { price: 15, days: 4, text: '4 Days' }
        ];

        let planHtml = '';
        plans.forEach(p => {
            planHtml += `<button class="modal-option-btn" onclick="openPaymentModal('membership', ${p.price}, ${p.days})"><i class="fa-solid fa-crown" style="width:20px; color:gold;"></i> Membership - ₹${p.price} (${p.text})</button>`;
        });

        const title = content.querySelector('.modal-title');
        if (title) title.insertAdjacentHTML('afterend', planHtml);
    }
}, 1000);

window.openPaymentModal = async (type, amount, days = 30) => {
    if (!auth.currentUser) return;

    window.paymentTypeContext = type;
    window.selectedPlanDays = days;

    if (type === 'membership') {
        const uSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (uSnap.exists()) {
            const uData = uSnap.data();
            const now = Date.now();

            if (uData.membershipStatus === 'active') {
                let expiry = 0;
                if (uData.membershipExpiry) {
                    expiry = uData.membershipExpiry.toMillis ? uData.membershipExpiry.toMillis() : new Date(uData.membershipExpiry).getTime();
                }

                if (expiry === 0 || now < expiry) {
                    window.showToast(`আপনার মেম্বারশিপ ইতিমধ্যেই অ্যাক্টিভ আছে!`);
                    document.getElementById('profile-menu-modal').classList.add('hidden');
                    return;
                } else {
                    await updateDoc(doc(db, "users", auth.currentUser.uid), { membershipStatus: 'expired' });
                }
            } else if (uData.membershipRequest === 'pending') {
                window.showToast("আপনার মেম্বারশিপ রিকোয়েস্ট পেন্ডিং আছে, অনুগ্রহ করে অপেক্ষা করুন।");
                document.getElementById('profile-menu-modal').classList.add('hidden');
                return;
            }
        }
    }

    document.getElementById('profile-menu-modal').classList.add('hidden');
    document.getElementById('verification-modal').classList.add('hidden');
    document.getElementById('payment-title').innerHTML = type === 'membership'
        ? `<i class="fa-solid fa-crown"></i> Get Membership (${days} Days)`
        : '<i class="fa-solid fa-certificate"></i> Get Verified';
    document.getElementById('payment-amount').innerText = `₹${amount}`;
    document.getElementById('payment-txn-id').value = '';
    document.getElementById('payment-modal').classList.remove('hidden');
};

window.submitPayment = async () => {
    const txnId = document.getElementById('payment-txn-id').value.trim();
    if (txnId.length < 10) return window.showToast("Enter a valid UPI Transaction ID");

    if (window.paymentTypeContext === 'membership') {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            membershipRequest: 'pending',
            paymentTxnId: txnId,
            requestedMembershipDays: window.selectedPlanDays || 30
        });
    } else if (window.paymentTypeContext === 'verification') {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            verificationStatus: 'pending',
            paymentTxnId: txnId
        });
    }

    window.showToast("Payment submitted to Admin for manual review!");
    document.getElementById('payment-modal').classList.add('hidden');
};

window.handleMembership = async (uid, status) => {
    if (status === 'active') {
        const uSnap = await getDoc(doc(db, "users", uid));
        let days = 30;
        if (uSnap.exists() && uSnap.data().requestedMembershipDays) {
            days = uSnap.data().requestedMembershipDays;
        }

        const expiryTimestamp = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
        await updateDoc(doc(db, "users", uid), {
            membershipStatus: 'active',
            membershipRequest: 'none',
            membershipExpiry: expiryTimestamp,
            requestedMembershipDays: null
        });

        const localUser = allUsers.find(u => u.uid === uid);
        if (localUser) {
            localUser.membershipStatus = 'active';
            localUser.membershipRequest = 'none';
            localUser.membershipExpiry = expiryTimestamp;
        }

        window.showToast(`Membership activated for ${days} Days!`);
        if (window.loadAdminPanel) window.loadAdminPanel();
    } else {
        await updateDoc(doc(db, "users", uid), { membershipRequest: 'rejected' });

        const localUser = allUsers.find(u => u.uid === uid);
        if (localUser) localUser.membershipRequest = 'rejected';

        window.showToast("Membership rejected");
        if (window.loadAdminPanel) window.loadAdminPanel();
    }
};

// ==========================================
// Reels Patch
// ==========================================
window.isReelsMuted = true;
window.allReelsGlobal = [];

(function setupReelsUI() {
    const topBarRight = document.querySelector('#home-page .top-bar div');
    if (topBarRight && !document.querySelector('.header-reel-btn')) {
        const oldReelIcon = topBarRight.querySelector('.fa-clapperboard');
        if (oldReelIcon) oldReelIcon.remove();
        const newReelBtn = document.createElement('div');
        newReelBtn.className = 'header-reel-btn';
        newReelBtn.innerHTML = '<i class="fa-solid fa-play"></i> Reel';
        newReelBtn.onclick = () => window.navigateTo('reels');
        topBarRight.prepend(newReelBtn);
    }

    const postsGrid = document.getElementById('profile-posts');
    if (postsGrid && !document.getElementById('custom-profile-tabs')) {
        const tabsHtml = `
            <div class="profile-tabs" id="custom-profile-tabs">
                <div class="profile-tab active" id="tab-posts" onclick="window.switchProfileTab('posts')"><i class="fa-solid fa-table-cells"></i></div>
                <div class="profile-tab" id="tab-reels" onclick="window.switchProfileTab('reels')"><i class="fa-solid fa-film"></i></div>
            </div>
            <div class="profile-grid hidden" id="profile-reels"></div>
        `;
        postsGrid.insertAdjacentHTML('beforebegin', tabsHtml);
    }

    if (!document.getElementById('reel-comments-modal')) {
        const reelModalHtml = `
        <div id="reel-comments-modal" class="modal-overlay hidden" onclick="if(event.target.classList.contains('modal-overlay')) this.classList.add('hidden')">
            <div class="modal-content" style="height: 70vh; display:flex; flex-direction:column; padding:0;">
                <div style="padding: 15px; border-bottom: 1px solid #dbdbdb; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; background:#fff; z-index:10;">
                    <span style="font-size:16px; font-weight:600;">Reel Comments</span>
                    <i class="fas fa-times" style="cursor:pointer; color:#8e8e8e; font-size:18px;" onclick="document.getElementById('reel-comments-modal').classList.add('hidden')"></i>
                </div>
                <div id="reel-comments-list" style="flex:1; overflow-y:auto; padding:15px; text-align:left; font-size:13px; background:#fff;"></div>
                <div class="comment-input-area" style="display:flex; border-top:1px solid #efefef; padding:15px; background:#fff; align-items:center;">
                    <input type="text" id="new-reel-comment-text" placeholder="Add a comment..." style="flex:1; border:none; outline:none; background:transparent;">
                    <button onclick="window.postReelComment()" style="background:none; border:none; color:#0095f6; font-weight:600; cursor:pointer;">Post</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', reelModalHtml);
    }
})();

// Override showPreviewModal for reels caption display
const _origPreviewModal = window.showPreviewModal;
window.showPreviewModal = () => {
    if (_origPreviewModal) _origPreviewModal();
    if (window.upType === 'reel') {
        const capBox = document.getElementById('upload-caption');
        if (capBox) capBox.style.display = 'block';
    }
};

// Override viewProfile to track global uid
const _origViewProfile = window.viewProfile;
window.viewProfile = (uid) => {
    const finalUid = uid || (auth.currentUser ? auth.currentUser.uid : null);
    window.globalProfileUid = finalUid;
    if (_origViewProfile) _origViewProfile(finalUid);
};

// Override navigateTo to load reels
const _origNav = window.navigateTo;
window.navigateTo = (page) => {
    if (_origNav) _origNav(page);
    if (page === 'reels') {
        window.loadReels();
    } else {
        document.querySelectorAll('.reel-video').forEach(v => v.pause());
    }
    if (page === 'profile') window.switchProfileTab('posts');
};

window.switchProfileTab = async (tab) => {
    const tabPosts = document.getElementById('tab-posts');
    const tabReels = document.getElementById('tab-reels');
    const targetTab = document.getElementById(`tab-${tab}`);
    const profilePosts = document.getElementById('profile-posts');
    const profileReels = document.getElementById('profile-reels');

    if (!profileReels) {
        console.warn('Reels grid not initialized yet');
        return;
    }
    if (tabPosts) tabPosts.classList.remove('active');
    if (tabReels) tabReels.classList.remove('active');
    if (targetTab) targetTab.classList.add('active');

    if (tab === 'posts') {
        if (profilePosts) profilePosts.classList.remove('hidden');
        if (profileReels) profileReels.classList.add('hidden');
    } else {
        if (profilePosts) profilePosts.classList.add('hidden');
        if (profileReels) profileReels.classList.remove('hidden');

        const uid = window.globalProfileUid || (auth.currentUser ? auth.currentUser.uid : null);
        if (!profileReels) return;

        profileReels.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';

        const q = query(collection(db, "reels"), where("uid", "==", uid));
        const snap = await getDocs(q);
        profileReels.innerHTML = '';

        if (snap.empty) {
            profileReels.innerHTML = '<p style="text-align:center; width:100%; padding:20px; color:#8e8e8e;">No reels yet.</p>';
            return;
        }

        snap.forEach(docSnap => {
            const r = docSnap.data();
            let thumbUrl = r.mediaUrl.includes('cloudinary.com')
                ? r.mediaUrl.replace('/upload/', '/upload/w_400,h_400,c_fill,so_0/').replace(/\.(mp4|webm|mov)$/i, '.jpg')
                : r.mediaUrl;
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.innerHTML = `
                <img src="${thumbUrl}" style="width:100%; height:100%; object-fit:cover;">
                <i class="fa-solid fa-play" style="position:absolute; top:5px; right:5px; color:white; font-size:12px; text-shadow: 0 1px 2px rgba(0,0,0,0.8);"></i>
            `;
            div.onclick = () => window.navigateTo('reels');
            profileReels.appendChild(div);
        });
    }
};

window.loadReels = async () => {
    const container = document.getElementById('reels-feed-container');
    if (!container) return;

    if (window.allReelsGlobal.length === 0) {
        container.innerHTML = '<div class="spinner" style="margin: 50vh auto;"></div>';
        const q = query(collection(db, "reels"));
        const snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = '<p style="color:white; text-align:center; margin-top:50vh;">No reels yet.</p>';
            return;
        }

        snap.forEach(docSnap => window.allReelsGlobal.push({ id: docSnap.id, ...docSnap.data() }));
    }

    container.innerHTML = '';

    let shuffledReels = [...window.allReelsGlobal].sort(() => Math.random() - 0.5);
    let currentlyRendered = 0;

    const renderNextReel = async () => {
        if (currentlyRendered >= shuffledReels.length) return;

        const reel = shuffledReels[currentlyRendered];
        currentlyRendered++;
        const reelId = reel.id;

        const uSnap = await getDoc(doc(db, "users", reel.uid));
        const u = uSnap.exists() ? uSnap.data() : { name: 'User', avatar: 'https://picsum.photos/100', followers: [] };

        const div = document.createElement('div');
        div.className = 'reel-item';

        const isLiked = reel.likes && auth.currentUser && reel.likes.includes(auth.currentUser.uid);
        const isFollowing = u.followers && auth.currentUser && u.followers.includes(auth.currentUser.uid);
        const isMyReel = auth.currentUser && reel.uid === auth.currentUser.uid;

        div.innerHTML = `
            <div class="reel-video-wrapper" style="position:relative; width:100%; height:100%;">
                <video class="reel-video" src="${reel.mediaUrl}" loop playsinline preload="metadata" ${window.isReelsMuted ? 'muted' : ''}></video>
                <div class="reel-volume-indicator"><i class="fas fa-volume-mute"></i></div>
                <div class="reel-overlay">
                    <div class="reel-info">
                        <div class="reel-user" onclick="event.stopPropagation(); window.viewProfile('${reel.uid}');">
                            <img src="${u.avatar || 'https://picsum.photos/100'}">
                            <div style="display:flex; flex-direction:column; justify-content:center;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="font-weight:600; font-size:14px; text-shadow:1px 1px 2px #000;">${u.name}</span>
                                    ${!isMyReel ? `<button class="reel-follow-btn" onclick="event.stopPropagation(); window.toggleReelFollow('${reel.uid}', this);">${isFollowing ? 'Following' : 'Follow'}</button>` : ''}
                                </div>
                            </div>
                        </div>
                        <div style="font-size:13px; text-shadow:1px 1px 2px #000; margin-top:5px;">${reel.caption || ''}</div>
                    </div>
                    <div class="reel-actions">
                        <div class="reel-action-btn like-btn-wrap" onclick="event.stopPropagation(); window.toggleReelLike('${reelId}', this)">
                            <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart" style="color: ${isLiked ? '#ed4956' : '#fff'};"></i>
                            <span class="likes-count">${(reel.likes || []).length}</span>
                        </div>
                        <div class="reel-action-btn" onclick="event.stopPropagation(); window.openReelComments('${reelId}')">
                            <i class="fa-regular fa-comment"></i>
                            <span class="comments-count">${(reel.comments || []).length}</span>
                        </div>
                        <div class="reel-action-btn" onclick="event.stopPropagation(); window.openShareModal('${reelId}', 'reel')">
                            <i class="fa-regular fa-paper-plane"></i>
                            <span>Share</span>
                        </div>
                        ${isMyReel ? `
                        <div class="reel-action-btn" onclick="event.stopPropagation(); window.askDeleteReel('${reelId}')" style="margin-top: 5px; color: #ff6b6b;">
                            <i class="fa-solid fa-trash-can" style="font-size: 20px;"></i>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;
        container.appendChild(div);

        const vidWrap = div.querySelector('.reel-video-wrapper');
        const vid = div.querySelector('.reel-video');
        const volInd = div.querySelector('.reel-volume-indicator');
        const likeBtn = div.querySelector('.like-btn-wrap');

        let lastTap = 0;
        let tapTimeout;
        vidWrap.addEventListener('click', (e) => {
            if (e.target.closest('.reel-actions') || e.target.closest('.reel-user') || e.target.closest('.reel-follow-btn')) return;
            const now = Date.now();
            if (now - lastTap < 300) {
                clearTimeout(tapTimeout);
                const isCurrentlyLiked = likeBtn.querySelector('i').classList.contains('fa-solid');
                const r = vidWrap.getBoundingClientRect();
                const h = document.createElement('div');
                h.className = 'like-animation';
                h.innerHTML = `<svg viewBox="0 0 24 24" fill="#ed4956" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
                h.style.left = (e.clientX - r.left) + 'px';
                h.style.top = (e.clientY - r.top) + 'px';
                vidWrap.appendChild(h);
                setTimeout(() => h.remove(), 600);
                if (!isCurrentlyLiked) window.toggleReelLike(reelId, likeBtn);
            } else {
                tapTimeout = setTimeout(() => {
                    window.isReelsMuted = !window.isReelsMuted;
                    vid.muted = window.isReelsMuted;
                    volInd.innerHTML = window.isReelsMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
                    volInd.classList.add('show');
                    setTimeout(() => volInd.classList.remove('show'), 1000);
                }, 300);
            }
            lastTap = now;
        });

        if (window.reelObserver) window.reelObserver.observe(div);
    };

    if (window.reelObserver) window.reelObserver.disconnect();
    window.reelObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const v = entry.target.querySelector('video');
            if (entry.isIntersecting) {
                if (v.paused) {
                    v.muted = window.isReelsMuted;
                    v.play().catch(e => {
                        v.muted = true;
                        window.isReelsMuted = true;
                        v.play().catch(err => {});
                    });
                }
                if (entry.target === container.lastElementChild) {
                    renderNextReel();
                }
            } else {
                if (!v.paused) { v.pause(); v.currentTime = 0; }
            }
        });
    }, { threshold: 0.6 });

    await renderNextReel();
    await renderNextReel();
    await renderNextReel();
};

window.askDeleteReel = (reelId) => {
    window.openProConfirm("এই রিলটি ডিলিট করতে চান?", async () => {
        document.getElementById('global-loader').classList.remove('hidden');
        try {
            await deleteDoc(doc(db, "reels", reelId));
            window.showToast("Reel Deleted!");
            window.allReelsGlobal = window.allReelsGlobal.filter(r => r.id !== reelId);
            window.loadReels();
        } catch (e) {
            window.showToast("Failed to delete Reel.");
        }
        document.getElementById('global-loader').classList.add('hidden');
    });
};

window.toggleReelLike = (reelId, btnElement) => {
    if (!auth.currentUser) return;

    const icon = btnElement.querySelector('i');
    const countSpan = btnElement.querySelector('.likes-count');

    const isCurrentlyLiked = icon.classList.contains('fa-solid');
    let currentCount = parseInt(countSpan.innerText) || 0;

    if (isCurrentlyLiked) {
        icon.className = 'fa-regular fa-heart';
        icon.style.color = '#fff';
        countSpan.innerText = Math.max(0, currentCount - 1);
    } else {
        icon.className = 'fa-solid fa-heart';
        icon.style.color = '#ed4956';
        countSpan.innerText = currentCount + 1;
        icon.style.transform = 'scale(1.3)';
        setTimeout(() => icon.style.transform = 'scale(1)', 150);
    }

    const reelRef = doc(db, "reels", reelId);
    if (isCurrentlyLiked) {
        updateDoc(reelRef, { likes: arrayRemove(auth.currentUser.uid) }).catch(e => console.log(e));
    } else {
        updateDoc(reelRef, { likes: arrayUnion(auth.currentUser.uid) }).catch(e => console.log(e));
    }
};

window.toggleReelFollow = (targetUid, btnElement) => {
    if (!auth.currentUser) return;

    const isCurrentlyFollowing = btnElement.innerText === 'Following';

    if (isCurrentlyFollowing) {
        btnElement.innerText = 'Follow';
        btnElement.style.background = 'transparent';
    } else {
        btnElement.innerText = 'Following';
        btnElement.style.background = 'rgba(255,255,255,0.2)';
    }

    if (window.toggleFollow) {
        window.toggleFollow(targetUid, isCurrentlyFollowing).catch(e => console.log(e));
    }
};

window.openReelComments = async (reelId) => {
    window.currentReelId = reelId;
    document.getElementById('reel-comments-modal').classList.remove('hidden');
    const l = document.getElementById('reel-comments-list');
    l.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';
    const rSnap = await getDoc(doc(db, "reels", reelId));
    const rData = rSnap.data();
    l.innerHTML = '';
    if (rData.comments && rData.comments.length > 0) {
        for (let c of rData.comments) {
            const uSnap = await getDoc(doc(db, "users", c.uid));
            const u = uSnap.exists() ? uSnap.data() : { name: 'User', avatar: 'https://picsum.photos/100' };
            const d = document.createElement('div');
            d.style.cssText = 'display:flex; gap:12px; margin-bottom:15px;';
            d.innerHTML = `<img src="${u.avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                           <div><div style="font-size:13px;"><strong>${u.name}</strong> <span>${c.text}</span></div></div>`;
            l.appendChild(d);
        }
    } else {
        l.innerHTML = '<div style="text-align:center; padding:20px; color:#8e8e8e;">No comments yet.</div>';
    }
};

window.postReelComment = async () => {
    const t = document.getElementById('new-reel-comment-text').value.trim();
    if (!t || !window.currentReelId || !auth.currentUser) return;
    const newComment = { uid: auth.currentUser.uid, text: t, timestamp: Date.now() };
    await updateDoc(doc(db, "reels", window.currentReelId), { comments: arrayUnion(newComment) });
    document.getElementById('new-reel-comment-text').value = '';
    window.openReelComments(window.currentReelId);
};

// ==========================================
// Draft Caption Save/Restore
// ==========================================
window.addEventListener('beforeunload', function (e) {
    const captionInput = document.getElementById('upload-caption');
    if (captionInput && captionInput.value.trim() !== '') {
        localStorage.setItem('insta_draft_caption', captionInput.value);
    }

    const uploadOverlay = document.getElementById('upload-progress-overlay');
    if (uploadOverlay && !uploadOverlay.classList.contains('hidden')) {
        e.preventDefault();
        e.returnValue = 'আপনার মিডিয়া আপলোড হচ্ছে! আপনি কি সত্যিই পেজ থেকে বেরিয়ে যেতে চান?';
        return e.returnValue;
    }
});

window.addEventListener('load', function () {
    const savedCaption = localStorage.getItem('insta_draft_caption');
    if (savedCaption) {
        const captionInput = document.getElementById('upload-caption');
        if (captionInput) captionInput.value = savedCaption;
        localStorage.removeItem('insta_draft_caption');
    }
});