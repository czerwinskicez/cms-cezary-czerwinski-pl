class FirebaseUploadAdapter {
    constructor(loader, firebaseApp) {
        this.loader = loader;
        if (!firebaseApp) {
            console.error("Firebase app instance not provided to FirebaseUploadAdapter.");
            return;
        }
        this.auth = firebaseApp.auth();
        this.storage = firebaseApp.storage();
    }

    upload() {
        return this.loader.file
            .then(file => new Promise((resolve, reject) => {
                const user = this.auth.currentUser;
                if (!user) {
                    return reject('User not authenticated.');
                }

                const storageRef = this.storage.ref(`blog_images/${user.uid}/${Date.now()}_${file.name}`);
                const uploadTask = storageRef.put(file);

                uploadTask.on('state_changed',
                    (snapshot) => {
                        // Observe state change events such as progress, pause, and resume
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log('Upload is ' + progress + '% done');
                        this.loader.uploadTotal = snapshot.totalBytes;
                        this.loader.uploaded = snapshot.bytesTransferred;
                    },
                    (error) => {
                        // Handle unsuccessful uploads
                        console.error('Upload failed:', error);
                        reject(error);
                    },
                    () => {
                        // Handle successful uploads on complete
                        uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                            resolve({
                                default: downloadURL
                            });
                        }).catch(error => {
                            console.error('Error getting download URL:', error);
                            reject(error);
                        });
                    }
                );
            }));
    }

    abort() {
        // This method is called when the upload is aborted.
        // In Firebase, if the uploadTask is active, you can cancel it.
        if (this.uploadTask && this.uploadTask.cancel) {
            this.uploadTask.cancel();
        }
    }
}

window.FirebaseUploadAdapter = FirebaseUploadAdapter; 