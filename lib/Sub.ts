import clamp from 'lodash/clamp';
import DT from 'duration-time-conversion';

export interface SubPayload {
  start: string;
  end: string;
  text: string;
  text2?: string;
}

export default class Sub {
  start: string;
  end: string;
  text: string;
  text2?: string;

  constructor(obj: SubPayload) {
    this.start = obj.start;
    this.end = obj.end;
    this.text = obj.text;
    this.text2 = obj.text2;
  }

  get check(): boolean {
    return this.startTime >= 0 && this.endTime >= 0 && this.startTime < this.endTime;
  }

  get clone(): Sub {
    return new Sub({
      start: this.start,
      end: this.end,
      text: this.text,
      text2: this.text2,
    });
  }

  get startTime(): number {
    return DT.t2d(this.start);
  }

  set startTime(time: number) {
    this.start = DT.d2t(clamp(time, 0, Number.POSITIVE_INFINITY));
  }

  get endTime(): number {
    return DT.t2d(this.end);
  }

  set endTime(time: number) {
    this.end = DT.d2t(clamp(time, 0, Number.POSITIVE_INFINITY));
  }

  get duration(): number {
    return parseFloat((this.endTime - this.startTime).toFixed(3));
  }
}
