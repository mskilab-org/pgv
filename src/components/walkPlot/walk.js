import { guid } from "../../helpers/utility";

class Walk {
  constructor(walk) {
    this.identifier = guid();
    this.primaryKey = `pid-${walk.pid}`;
    this.pid = walk.pid;
    this.cn = walk.cn;
    this.type = walk.type;
    this.strand = walk.strand;
    this.cids = walk.cids;
    this.iids = walk.iids;
    this.title = `pid: ${this.pid} | cn: ${this.cn} | type: ${this.type} | strand: ${this.strand}`;
  }

  get toString() {
    return `identifier: ${this.identifier},
    title: ${this.title}
    pid: ${this.pid},
    cn: ${this.cn},
    type: ${this.type},
    strand: ${this.strand}
    connections: ${this.cids.length}
    intervals: ${this.iids.length}
    `;
  }
}
export default Walk;
