"""
Test fixture: Django models and ORM patterns

Tests:
- Model definitions
- Field types
- Relationships (ForeignKey, ManyToMany)
- Model methods
- Meta options
- Managers
"""

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from typing import Optional


class TimeStampedModel(models.Model):
    """Abstract base model with timestamps"""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True


class User(AbstractUser, TimeStampedModel):
    """Custom user model"""
    email = models.EmailField(unique=True)
    bio = models.TextField(blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    location = models.CharField(max_length=100, blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['username']),
        ]
    
    def __str__(self) -> str:
        return self.username
    
    def get_full_name(self) -> str:
        """Get user's full name"""
        return f"{self.first_name} {self.last_name}".strip() or self.username
    
    def verify_email(self) -> None:
        """Mark email as verified"""
        self.is_verified = True
        self.save(update_fields=['is_verified'])


class Category(TimeStampedModel):
    """Blog category model"""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    
    class Meta:
        db_table = 'categories'
        verbose_name_plural = 'categories'
        ordering = ['name']
    
    def __str__(self) -> str:
        return self.name


class PostManager(models.Manager):
    """Custom manager for Post model"""
    
    def published(self):
        """Get published posts"""
        return self.filter(status='published', published_at__lte=timezone.now())
    
    def drafts(self):
        """Get draft posts"""
        return self.filter(status='draft')
    
    def by_author(self, author: User):
        """Get posts by author"""
        return self.filter(author=author)


class Post(TimeStampedModel):
    """Blog post model"""
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    content = models.TextField()
    excerpt = models.TextField(blank=True)
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='posts'
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='posts'
    )
    tags = models.ManyToManyField('Tag', related_name='posts', blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )
    published_at = models.DateTimeField(null=True, blank=True)
    views_count = models.PositiveIntegerField(default=0)
    
    objects = PostManager()
    
    class Meta:
        db_table = 'posts'
        ordering = ['-published_at', '-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['status', 'published_at']),
        ]
    
    def __str__(self) -> str:
        return self.title
    
    def publish(self) -> None:
        """Publish the post"""
        self.status = 'published'
        self.published_at = timezone.now()
        self.save(update_fields=['status', 'published_at'])
    
    def increment_views(self) -> None:
        """Increment view count"""
        self.views_count += 1
        self.save(update_fields=['views_count'])
    
    @property
    def is_published(self) -> bool:
        """Check if post is published"""
        return (
            self.status == 'published' and
            self.published_at and
            self.published_at <= timezone.now()
        )


class Tag(TimeStampedModel):
    """Tag model for posts"""
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True)
    
    class Meta:
        db_table = 'tags'
        ordering = ['name']
    
    def __str__(self) -> str:
        return self.name


class Comment(TimeStampedModel):
    """Comment model"""
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    content = models.TextField()
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies'
    )
    is_approved = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'comments'
        ordering = ['-created_at']
    
    def __str__(self) -> str:
        return f"Comment by {self.author.username} on {self.post.title}"
    
    def approve(self) -> None:
        """Approve the comment"""
        self.is_approved = True
        self.save(update_fields=['is_approved'])

