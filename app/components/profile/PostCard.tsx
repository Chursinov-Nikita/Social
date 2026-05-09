import Image from "next/image";
import { Heart, MessageCircle } from "lucide-react";
import { UserPost } from "@/app/types/profile";
import { Translation } from "@/app/translation/translation";

const PostCard = ({ post, tr }: { post: UserPost; tr: Translation }) => {
  return (
    <article className="rounded-xl border border-(--border) bg-(--bg-primary) p-3">
      {post.imageUrl && (
        <div className="relative mb-3 h-36 overflow-hidden rounded-xl border border-(--border)">
          <Image
            src={post.imageUrl}
            alt="Post image"
            fill
            className="object-cover"
          />
        </div>
      )}
      <p className="line-clamp-2 text-sm leading-relaxed text-(--text-primary)/70">
        {post.content?.trim() || (post.imageUrl ? tr.imagePost : tr.noText)}
      </p>
      <div className="mt-3 flex items-center gap-4 text-[10px] font-medium uppercase tracking-wider">
        <span className="inline-flex items-center gap-1 text-(--text-primary)/50">
          <Heart size={11} strokeWidth={1.5} />
          {post._count.likes}
        </span>
        <span className="inline-flex items-center gap-1 text-(--text-primary)/50">
          <MessageCircle size={11} strokeWidth={1.5} />
          {post._count.comments}
        </span>
        <span className="ml-auto tabular-nums text-(--text-primary)/30">
          {new Date(post.createdAt).toLocaleDateString()}
        </span>
      </div>
    </article>
  );
};

export default PostCard;
