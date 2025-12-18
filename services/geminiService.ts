// This service encapsulates all interactions with the Google Gemini API.
import { GoogleGenAI, Content, Type, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { UserProfile, ChatMessage, GeneratedQuiz, PrebuiltVoice } from '../types';

// Per guidelines, initialize with API key from environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const textModel = 'gemini-2.5-pro';
const chatbotModel = 'gemini-2.5-flash';
const imageModel = 'gemini-2.5-flash-image';
const ttsModel = 'gemini-2.5-flash-preview-tts';
const fastEditModel = 'gemini-2.5-flash'; // Optimized for quick text edits

export const SUPPORTED_VOICES: { id: PrebuiltVoice; name: string }[] = [
    { id: 'Kore', name: 'Giọng Nữ - Thân thiện' },
    { id: 'Zephyr', name: 'Giọng Nữ - Trầm ấm' },
    { id: 'Puck', name: 'Giọng Nam - Rõ ràng' },
    { id: 'Charon', name: 'Giọng Nam - Trầm' },
    { id: 'Fenrir', name: 'Giọng Nam - Ấm áp' },
];

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
];

function getSystemInstruction(profile: UserProfile): string {
    return `Bạn là "Gia sư AI Đáng tin cậy" được thiết kế để hỗ trợ học sinh tự học tại nhà. Vai trò chính của bạn là cung cấp một trải nghiệm học tập cá nhân hóa, chuyên sâu và đảm bảo độ chính xác tuyệt đối của mọi thông tin về môn học ${profile.subject}. Mục tiêu là giúp học sinh không cần phải đi học thêm.

***PHƯƠNG PHÁP GIẢNG DẠY (RẤT QUAN TRỌNG):***
1.  **Phương pháp Socratic:** Không chỉ đưa ra câu trả lời, hãy đặt câu hỏi ngược lại, gợi ý, và hướng dẫn học sinh tự tìm ra giải pháp. Kích thích tư duy phản biện.
2.  **Gợi ý câu hỏi tiếp theo:** Sau mỗi câu trả lời, hãy cung cấp 3 câu hỏi gợi ý để học sinh có thể đào sâu kiến thức. Các câu hỏi này phải liên quan trực tiếp đến chủ đề vừa thảo luận. Định dạng chúng ở cuối câu trả lời của bạn, bắt đầu bằng một dòng chứa chính xác chuỗi ký tự: "[SUGGESTED_QUESTIONS]". Mỗi câu hỏi nằm trên một dòng riêng, bắt đầu bằng dấu "- ".

Ví dụ định dạng đầu ra:
[Nội dung câu trả lời của bạn ở đây]
[SUGGESTED_QUESTIONS]
- Câu hỏi gợi ý 1 là gì?
- Câu hỏi gợi ý 2 liên quan như thế nào?
- Tại sao câu hỏi gợi ý 3 lại quan trọng?

Thông tin học sinh:
- Trình độ: ${profile.level}.
- Mục tiêu: ${profile.goal}.
- Luôn giao tiếp bằng tiếng Việt.

***QUY TẮC AN TOÀN VÀ PHÙ HỢP (RẤT QUAN TRỌNG):***
- Bạn PHẢI từ chối trả lời các câu hỏi về chủ đề nhạy cảm không phù hợp với môi trường học tập, bao gồm nhưng không giới hạn ở: nội dung 18+, bạo lực cực đoan, tự hại, ngôn từ thù ghét, các hoạt động bất hợp pháp.
- **Ngoại lệ:** Nếu chủ đề đó liên quan trực tiếp và cần thiết cho môn học "${profile.subject}" (ví dụ: thảo luận về cơ quan sinh sản trong môn Sinh học), bạn được phép trả lời. Tuy nhiên, câu trả lời PHẢI mang tính khoa học, trung lập, hoàn toàn phù hợp với lứa tuổi và không đi sâu vào các chi tiết không cần thiết.
- Nếu phải từ chối, hãy trả lời một cách lịch sự, ngắn gọn và chuyển hướng cuộc trò chuyện. Ví dụ: "Là một gia sư AI, tôi không thể thảo luận về chủ đề này. Chúng ta hãy cùng quay lại với môn ${profile.subject} nhé!"`;
}

export const generateInitialMessage = async (profile: UserProfile): Promise<string> => {
    const prompt = `Bạn là một gia sư AI. Hãy tạo một lời chào mừng và kế hoạch học tập cực kỳ ngắn gọn (3-4 gạch đầu dòng) cho học sinh có thông tin sau:
- Môn học: ${profile.subject}
- Trình độ: ${profile.level}
- Mục tiêu: ${profile.goal}

Bắt đầu bằng lời chào thân thiện. **Quan trọng: Giữ toàn bộ câu trả lời dưới 80 từ.**`;

    const response = await ai.models.generateContent({
        model: textModel,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return response.text;
};

const mapMessagesToContent = (messages: ChatMessage[]): Content[] => {
    return messages.map(msg => {
        const parts: ({ text: string; } | { inlineData: { mimeType: string; data: string; }; })[] = [];
        if (msg.content) {
            parts.push({ text: msg.content });
        }
        if (msg.role === 'user' && msg.userImage) {
            parts.push({
                inlineData: {
                    data: msg.userImage.base64,
                    mimeType: msg.userImage.mimeType,
                }
            });
        }
        return {
            role: msg.role,
            parts: parts.length > 0 ? parts : [{text: ""}], // API requires non-empty parts
        };
    });
};

export const continueConversationStream = async function* (
    history: ChatMessage[],
    newMessage: string,
    profile: UserProfile,
    image?: { base64: string; mimeType: string } | null
): AsyncGenerator<string> {
    const geminiHistory = mapMessagesToContent(history.slice(0, -1));

    const userParts: ({ text: string; } | { inlineData: { mimeType: string; data: string; }; })[] = [];
    if (newMessage) {
        userParts.push({ text: newMessage });
    }
    if (image) {
        userParts.push({
            inlineData: {
                data: image.base64,
                mimeType: image.mimeType,
            }
        });
    }

    const contents = [...geminiHistory, { role: "user", parts: userParts }];

    const responseStream = await ai.models.generateContentStream({
        model: textModel,
        contents,
        config: {
            systemInstruction: getSystemInstruction(profile),
        },
        safetySettings,
    });

    for await (const chunk of responseStream) {
        yield chunk.text;
    }
};

export const getChatbotResponseStream = async function* (
    history: ChatMessage[],
    newMessage: string
): AsyncGenerator<string> {
    const geminiHistory = mapMessagesToContent(history);
    const contents = [...geminiHistory, { role: 'user', parts: [{ text: newMessage }] }];

    const responseStream = await ai.models.generateContentStream({
        model: chatbotModel,
        contents,
        config: {
            systemInstruction: "Bạn là một trợ lý AI thân thiện và hữu ích. Luôn giao tiếp bằng tiếng Việt.",
        },
        safetySettings,
    });

    for await (const chunk of responseStream) {
        yield chunk.text;
    }
}


const quizSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: "Một danh sách các câu hỏi trắc nghiệm.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING, description: "Nội dung câu hỏi." },
                    options: { type: Type.ARRAY, description: "Danh sách 4 lựa chọn.", items: { type: Type.STRING } },
                    answer: { type: Type.STRING, description: "Đáp án đúng cho câu hỏi." },
                    explanation: { type: Type.STRING, description: "Giải thích ngắn gọn tại sao đáp án lại đúng." }
                },
                required: ["question", "options", "answer", "explanation"]
            }
        }
    },
    required: ["questions"]
};

export const generateQuiz = async (history: ChatMessage[], profile: UserProfile): Promise<GeneratedQuiz> => {
    const prompt = "Dựa trên cuộc trò chuyện của chúng ta cho đến nay, hãy tạo một bài kiểm tra ngắn (khoảng 3-5 câu hỏi) để kiểm tra sự hiểu biết của tôi. Trả lời bằng JSON theo schema được cung cấp.";
    const geminiHistory: Content[] = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }],
    }));

    const response = await ai.models.generateContent({
        model: textModel,
        contents: [...geminiHistory.slice(0, -1), { role: "user", parts: [{ text: prompt }] }],
        config: {
            systemInstruction: getSystemInstruction(profile),
            responseMimeType: "application/json",
            responseSchema: quizSchema,
        }
    });

    try {
        const jsonText = response.text.trim();
        const quizData = JSON.parse(jsonText);
        if (quizData.questions && Array.isArray(quizData.questions)) {
             return quizData;
        }
       throw new Error("Invalid quiz format received from API.");
    } catch(e) {
        console.error("Failed to parse quiz JSON:", e);
        throw new Error("Không thể tạo bài kiểm tra vào lúc này.");
    }
};

export const generateImage = async (prompt: string): Promise<string> => {
    const imageGenerationPrompt = `Một hình ảnh minh họa theo phong cách giáo dục, đơn giản và rõ ràng về: ${prompt}`;
    const response = await ai.models.generateContent({
        model: imageModel,
        contents: { parts: [{ text: imageGenerationPrompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    throw new Error("Không thể tạo hình ảnh.");
};

export const generateSpeech = async (text: string, voice: PrebuiltVoice): Promise<string> => {
    const response = await ai.models.generateContent({
        model: ttsModel,
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        return base64Audio;
    }
    throw new Error("Không thể tạo âm thanh.");
};

export type EditAction = 'fix_grammar' | 'improve_writing' | 'translate_en' | 'suggest_question';

export const refineText = async (text: string, action: EditAction): Promise<string> => {
    let prompt = "";
    switch (action) {
        case 'fix_grammar':
            prompt = `Sửa lỗi chính tả và ngữ pháp tiếng Việt cho đoạn văn sau. Chỉ trả về nội dung đã sửa, không giải thích thêm: "${text}"`;
            break;
        case 'improve_writing':
            prompt = `Viết lại đoạn văn sau sao cho tự nhiên, trôi chảy và học thuật hơn. Chỉ trả về nội dung đã viết lại, không giải thích thêm: "${text}"`;
            break;
        case 'translate_en':
            prompt = `Dịch đoạn văn sau sang tiếng Anh. Chỉ trả về nội dung dịch, không giải thích thêm: "${text}"`;
            break;
        case 'suggest_question':
            prompt = `Dựa trên ngữ cảnh: "${text || 'Tôi đang học bài'}", hãy gợi ý 1 câu hỏi ngắn gọn mà tôi có thể hỏi gia sư. Chỉ trả về câu hỏi.`;
            break;
        default:
            return text;
    }

    const response = await ai.models.generateContent({
        model: fastEditModel,
        contents: { parts: [{ text: prompt }] },
    });

    return response.text.trim();
};