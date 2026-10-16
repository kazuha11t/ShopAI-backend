
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'GEMINI_API_KEY') {
          return 'test-api-key';
        }

        if (key === 'GEMINI_MODEL') {
          return 'gemini-flash-latest';
        }

        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
