import { Injectable, Logger } from '@nestjs/common';

export interface RegexExtracted {
  email:        string | null;
  phone:        string | null;
  linkedin_url: string | null;
}

@Injectable()
export class RegexExtractorService {
  private readonly logger = new Logger(RegexExtractorService.name);

  extract(text: string): RegexExtracted {
    const result = {
      email:        this.extractEmail(text),
      phone:        this.extractPhone(text),
      linkedin_url: this.extractLinkedIn(text),
    };

    this.logger.log(`🔍 Regex extracted:`);
    this.logger.log(`   Email    : ${result.email        ?? 'NOT FOUND'}`);
    this.logger.log(`   Phone    : ${result.phone        ?? 'NOT FOUND'}`);
    this.logger.log(`   LinkedIn : ${result.linkedin_url ?? 'NOT FOUND'}`);

    return result;
  }

  private extractEmail(text: string): string | null {
    const match = text.match(
      /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
    );
    return match ? match[0].toLowerCase() : null;
  }

  private extractPhone(text: string): string | null {
    // Handles: 99423580 / +216 99 423 580 / 00216 99 423 580
    const match = text.match(
      /(?:(?:\+|00)216[\s.-]?)?(?:[2457689]\d{7}|\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d)/
    );
    if (!match) return null;

    let phone = match[0].replace(/[\s.\-()]/g, '');

    // Add +216 if looks Tunisian (8 digits starting with valid Tunisian prefix)
    if (/^[2457689]\d{7}$/.test(phone)) {
      phone = '+216' + phone;
    }

    return phone;
  }

  private extractLinkedIn(text: string): string | null {
    const match = text.match(
      /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?/i
    );
    return match ? match[0] : null;
  }
}