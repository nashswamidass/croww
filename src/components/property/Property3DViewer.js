import { Platform } from 'react-native';
import Property3DViewerNative from './Property3DViewer.native';
import Property3DViewerWeb from './Property3DViewer.web';

const Property3DViewer = Platform.OS === 'web' ? Property3DViewerWeb : Property3DViewerNative;

export default Property3DViewer;
