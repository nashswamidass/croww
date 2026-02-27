import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import { userService } from '../services/userService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {
        let profileUnsubscribe = null;

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (profileUnsubscribe) profileUnsubscribe();

            setLoading(true);
            if (firebaseUser) {
                // Set up real-time listener for user profile (to catch isBlocked changes)
                profileUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
                    if (snapshot.exists()) {
                        const userData = { ...snapshot.data(), id: firebaseUser.uid };
                        setUser(userData);
                        setIsBlocked(userData.isBlocked === true);

                        // Cache locally
                        await userService.saveUserToStorage(userData);
                    } else {
                        setUser(null);
                        setIsBlocked(false);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("[AuthContext] Profile listener error:", error);
                    setLoading(false);
                });
            } else {
                setUser(null);
                setIsBlocked(false);
                setLoading(false);
                await userService.logout();
            }
        });

        return () => {
            unsubscribe();
            if (profileUnsubscribe) profileUnsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAuthenticated: !!user,
            isBlocked,
            setUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
