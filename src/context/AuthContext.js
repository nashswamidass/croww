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

            if (firebaseUser) {
                setLoading(true); // Only show loading when fetching a new profile

                // Hard absolute safety net: no matter what, clear loading within 12s.
                // This is the last line of defense against any permanent UI freeze.
                const absoluteTimeoutId = setTimeout(() => {
                    console.warn('[AuthContext] ABSOLUTE safety timeout triggered — forcing loading=false');
                    setLoading(false);
                }, 12000);

                // Anti-freeze fallback for iPad/IPv6 network deadlock (5s)
                const fallbackTimer = setTimeout(async () => {
                    console.warn('[AuthContext] Anti-freeze timeout triggered: Profile fetch hung.');
                    
                    try {
                        const localUser = await userService.getUser();
                        if (localUser && localUser.id === firebaseUser.uid) {
                            console.log('[AuthContext] Using local cache due to network timeout');
                            setUser(localUser);
                            setIsBlocked(localUser.isBlocked === true);
                        } else {
                            console.log('[AuthContext] Fallback to basic session');
                            // Create a very basic session so the app isn't unresponsive
                            setUser({ id: firebaseUser.uid, email: firebaseUser.email, role: 'individual' });
                            setIsBlocked(false);
                        }
                    } catch (e) {
                         setUser({ id: firebaseUser.uid, email: firebaseUser.email, role: 'individual' });
                    }
                    
                    setLoading(false);
                    clearTimeout(absoluteTimeoutId);
                }, 5000);

                // Set up real-time listener for user profile (to catch isBlocked changes)
                profileUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
                    // Clear timers FIRST — we have data now
                    clearTimeout(fallbackTimer);
                    clearTimeout(absoluteTimeoutId);

                    if (snapshot.exists()) {
                        const userData = { ...snapshot.data(), id: firebaseUser.uid };
                        setUser(userData);
                        setIsBlocked(userData.isBlocked === true);
                    } else {
                        setUser(null);
                        setIsBlocked(false);
                    }

                    // CRITICAL FIX: Call setLoading(false) BEFORE any async storage write.
                    // Previously, `await saveUserToStorage()` could hang on iPadOS, leaving
                    // loading=true forever after both safety timers had already been cleared.
                    setLoading(false);

                    // Cache locally — fire-and-forget, never blocks the UI
                    if (snapshot.exists()) {
                        const userData = { ...snapshot.data(), id: firebaseUser.uid };
                        userService.saveUserToStorage(userData).catch(e =>
                            console.warn('[AuthContext] Storage write failed (non-critical):', e.message)
                        );
                    }
                }, (error) => {
                    console.error("[AuthContext] Profile listener error:", error);
                    clearTimeout(fallbackTimer);
                    clearTimeout(absoluteTimeoutId);
                    setLoading(false);
                });
            } else {
                // Non-blocking logout transition
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
