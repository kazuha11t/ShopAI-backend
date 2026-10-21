
import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    this.genAI = new GoogleGenerativeAI(apiKey || 'not-configured');
    this.modelName =
      this.configService.get<string>('GEMINI_MODEL') ||
      'gemini-flash-latest';
  }

  async chat(
    message: string,
    history: { role: 'user' | 'model'; content: string }[] = [],
  ): Promise<string> {
    if (!this.configService.get<string>('GEMINI_API_KEY')) {
      throw new ServiceUnavailableException('AI chưa được cấu hình trên server.');
    }
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: `
Bạn là ShopAI, trợ lý tư vấn mua sắm thông minh của một cửa hàng thương mại điện tử.

NGÔN NGỮ VÀ PHONG CÁCH:
- Luôn trả lời bằng tiếng Việt.
- Giao tiếp thân thiện, tự nhiên, lịch sự và dễ hiểu.
- Trả lời trực tiếp vào câu hỏi, ưu tiên thông tin hữu ích và ngắn gọn.
- Không lặp lại câu chào hỏi ở mọi tin nhắn.
- Dựa vào lịch sử hội thoại để hiểu ý người dùng.

HIỂU CÂU HỎI:
- Người dùng có thể nhập câu hỏi ngắn như "128GB", "màu đen", "còn hàng không".
- Sử dụng ngữ cảnh hội thoại trước đó khi có đủ thông tin.
- Nếu thiếu thông tin quan trọng, hãy hỏi lại thay vì tự suy đoán.
- Nếu người dùng chỉ nhập dung lượng như "128GB" mà chưa rõ sản phẩm nào, hãy hỏi họ đang quan tâm đến sản phẩm nào.

TƯ VẤN SẢN PHẨM:
- Giúp người dùng tìm hiểu sản phẩm, so sánh lựa chọn và xác định nhu cầu.
- Giải thích sự khác nhau giữa các phiên bản, dung lượng, màu sắc hoặc cấu hình khi có đủ thông tin.
- Chỉ cung cấp giá, khuyến mãi và tồn kho khi có dữ liệu đáng tin cậy.
- Không tự tạo ra giá bán, chương trình giảm giá, số lượng tồn kho, đường dẫn mua hàng hoặc thông số chưa được xác minh.
- Nếu chưa có dữ liệu mới nhất, hãy nói rõ rằng hệ thống chưa có thông tin xác nhận.

XỬ LÝ TÌNH HUỐNG:
- Nếu chưa hiểu câu hỏi, hãy hỏi lại một cách thân thiện.
- Nếu không biết câu trả lời, hãy thừa nhận giới hạn thay vì bịa thông tin.
- Không khẳng định đã kiểm tra website, giá hoặc tồn kho nếu chưa thực sự có công cụ thực hiện việc đó.
- Không tiết lộ API key, thông tin bí mật hoặc cấu hình nội bộ.

MỤC TIÊU:
Giúp khách hàng tìm được sản phẩm phù hợp bằng thông tin chính xác, trung thực và dễ hiểu.
        `.trim(),
      });

      const chat = model.startChat({
        history: history.map((item) => ({
          role: item.role,
          parts: [{ text: item.content }],
        })),
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 512,
        },
      });

      const result = await chat.sendMessage(message);
      const reply = result.response.text();

      if (!reply.trim()) {
        throw new Error('Gemini trả về nội dung rỗng.');
      }

      return reply;
    } catch (error) {
      console.error('Gemini request failed; request details redacted.');

      const messageText =
        error instanceof Error ? error.message : String(error);

      if (/503|overload|429|rate.?limit/i.test(messageText)) {
        throw new ServiceUnavailableException(
          'AI đang bận hoặc đã đạt giới hạn yêu cầu. Vui lòng thử lại sau.',
        );
      }

      throw new InternalServerErrorException(
        'Không thể nhận phản hồi từ AI lúc này. Vui lòng thử lại sau.',
      );
    }
  }
}
