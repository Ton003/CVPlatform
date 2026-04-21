import { Test, TestingModule } from '@nestjs/testing';
import { InternalMobilityController } from './internal-mobility.controller';
import { UnifiedScoringService } from '../shared/services/unified-scoring.service';
import { GapAction } from './dto/gap-analysis.dto';

describe('InternalMobilityController', () => {
  let controller: InternalMobilityController;
  let scoringService: UnifiedScoringService;

  const mockScoringService = {
    scoreEmployee: jest.fn(),
    getGapAnalysis: jest.fn(),
    getOfferMatches: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalMobilityController],
      providers: [
        {
          provide: UnifiedScoringService,
          useValue: mockScoringService,
        },
      ],
    }).compile();

    controller = module.get<InternalMobilityController>(InternalMobilityController);
    scoringService = module.get<UnifiedScoringService>(UnifiedScoringService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getEmployeeMatch', () => {
    it('should return score result for employee and offer', async () => {
      const mockResult = {
        totalScore: 85,
        isComplete: true,
        breakdown: {
          technical: { score: 90, weight: 30, available: true },
          behavioral: { score: 80, weight: 20, available: true },
          interview: { score: null, weight: 40, available: false },
          managerial: { score: 85, weight: 10, available: true }
        },
        suggestedAction: GapAction.PROMOTION_READY
      };

      mockScoringService.scoreEmployee.mockResolvedValue(mockResult);

      const result = await controller.getEmployeeMatch('emp-1', 'offer-1');
      expect(result).toEqual(mockResult);
      expect(scoringService.scoreEmployee).toHaveBeenCalledWith('emp-1', 'offer-1');
    });
  });

  describe('getGapAnalysis', () => {
    it('should return gap analysis report', async () => {
      const mockReport = {
        title: 'Gap Analysis: John vs Senior Dev',
        gaps: [],
        priorityGaps: [],
        suggestedAction: GapAction.NEAR_READY,
        summary: { totalRequirements: 0, metCount: 0, gapCount: 0 }
      };

      mockScoringService.getGapAnalysis.mockResolvedValue(mockReport);

      const result = await controller.getGapAnalysis('emp-1', 'level-1');
      expect(result).toEqual(mockReport);
      expect(scoringService.getGapAnalysis).toHaveBeenCalledWith('emp-1', 'level-1');
    });
  });

  describe('getOfferMatches', () => {
    it('should return matched employees with minScore filter', async () => {
      const mockResult = [{ uuid: 'emp-1', firstName: 'John', totalScore: 75 }];
      mockScoringService.getOfferMatches.mockResolvedValue(mockResult);

      const result = await controller.getOfferMatches('offer-1', 70);
      expect(result).toEqual(mockResult);
      expect(scoringService.getOfferMatches).toHaveBeenCalledWith('offer-1', 70);
    });

    it('should use 0 if minScore is not provided', async () => {
      mockScoringService.getOfferMatches.mockResolvedValue([]);
      
      await controller.getOfferMatches('offer-1');
      expect(scoringService.getOfferMatches).toHaveBeenCalledWith('offer-1', 0);
    });
  });
});
